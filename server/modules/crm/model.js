/**
 * CRM客户关系管理模块 - 数据模型
 * 包含：客户管理、联系人管理、客户分类、沟通记录、跟进管理
 */

import { getDatabase, generateId } from '../../config/database.js'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { translateText } from '../../utils/translate.js'
import { pinyin } from 'pinyin-pro'

/**
 * 获取名称的拼音首字母（大写）
 * 支持中文和英文混合
 * @param {string} name - 客户名称
 * @returns {string} - 拼音首字母（大写），如"傲翼" -> "AY"
 */
function getNameInitials(name) {
  if (!name || typeof name !== 'string') {
    return 'XX' // 默认值
  }
  
  // 去除空格和特殊字符，只保留中文和英文字母
  const cleanName = name.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '')
  
  if (!cleanName) {
    return 'XX'
  }
  
  let initials = ''
  
  for (const char of cleanName) {
    // 检查是否是中文字符
    if (/[\u4e00-\u9fa5]/.test(char)) {
      // 获取中文拼音首字母
      const py = pinyin(char, { pattern: 'first', toneType: 'none' })
      initials += py.toUpperCase()
    } else if (/[a-zA-Z]/.test(char)) {
      // 英文字母直接取大写
      initials += char.toUpperCase()
    }
  }
  
  // 限制首字母长度（最多4个字符，避免过长）
  return initials.slice(0, 4) || 'XX'
}

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

// 合同签署状态
export const CONTRACT_SIGN_STATUS = {
  UNSIGNED: 'unsigned',         // 未签署
  PENDING_SIGN: 'pending_sign', // 待签署（合同已生成，待跟单人员签署）
  SIGNED: 'signed',             // 已签署
  REJECTED: 'rejected'          // 已拒签
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
 * 生成客户编码
 * 新格式：简称拼音首字母 + 年月(YYMM) + 4位序号
 * 示例：傲翼 + 2024年1月 -> AY24010001
 * 序号按年月递增，同一年月的所有客户共享一个序号池
 * @param {string} customerName - 客户名称（用于提取拼音首字母）
 * @returns {Promise<string>} - 生成的客户编码
 */
export async function generateCustomerCode(customerName) {
  const db = getDatabase()
  const today = new Date()
  
  // 获取年月：YYMM格式（2位年+2位月）
  const year = today.getFullYear().toString().slice(-2) // 后2位年份
  const month = (today.getMonth() + 1).toString().padStart(2, '0') // 2位月份
  const yearMonth = `${year}${month}` // 如: 2512
  
  // 获取客户名称的拼音首字母
  const initials = getNameInitials(customerName)
  
  // 序列号业务类型：按年月分组，同一年月共享序号池
  const businessType = `CUSTOMER_${yearMonth}`
  
  // 先尝试插入新的序列号记录（如果不存在）
  await db.prepare(`
    INSERT INTO order_sequences (business_type, current_seq, description, updated_at)
    VALUES (?, 0, ?, NOW())
    ON CONFLICT (business_type) DO NOTHING
  `).run(businessType, `客户编号序列 - ${year}年${month}月`)
  
  // 检查是否需要同步序列号（防止序列号表落后于实际数据）
  const maxSeqResult = await db.prepare(`
    SELECT MAX(CAST(RIGHT(customer_code, 4) AS INTEGER)) as max_seq 
    FROM customers 
    WHERE customer_code ~ ('^[A-Z]+' || $1 || '[0-9]{4}$')
  `).get(yearMonth)
  const maxSeqInDb = maxSeqResult?.max_seq || 0
  
  const currentSeqResult = await db.prepare(`
    SELECT current_seq FROM order_sequences WHERE business_type = ?
  `).get(businessType)
  const currentSeq = currentSeqResult?.current_seq || 0
  
  // 如果数据库中的最大序号大于序列号表，需要同步
  if (maxSeqInDb > currentSeq) {
    await db.prepare(`
      UPDATE order_sequences SET current_seq = ?, updated_at = NOW() WHERE business_type = ?
    `).run(maxSeqInDb, businessType)
    console.log(`🔄 客户编号序列已同步: ${currentSeq} -> ${maxSeqInDb}`)
  }
  
  // 原子操作：递增并返回新序号（防止并发导致重复）
  const result = await db.prepare(`
    UPDATE order_sequences 
    SET current_seq = current_seq + 1, updated_at = NOW()
    WHERE business_type = ?
    RETURNING current_seq
  `).get(businessType)
  
  const seq = result?.current_seq || 1
  
  // 返回完整编码：首字母 + 年月 + 4位序号
  return `${initials}${yearMonth}${seq.toString().padStart(4, '0')}`
}

/**
 * 创建客户
 */
export async function createCustomer(data) {
  const db = getDatabase()
  const id = generateId()
  
  // 自动生成客户编码（如果没有提供）
  // 新格式：简称拼音首字母 + 年月(YYMM) + 4位序号
  const customerCode = data.customerCode || await generateCustomerCode(data.customerName)
  
  // 自动翻译公司中文全称为英文（如果有中文名称且没有提供英文名称）
  let companyNameEn = data.companyNameEn || ''
  if (data.companyName && !companyNameEn) {
    try {
      companyNameEn = await translateText(data.companyName, 'zh-CN', 'en')
      console.log(`[客户创建] 自动翻译公司名称: ${data.companyName} -> ${companyNameEn}`)
    } catch (error) {
      console.error('[客户创建] 翻译公司名称失败:', error.message)
      companyNameEn = '' // 翻译失败时保持为空
    }
  }
  
  const result = await db.prepare(`
    INSERT INTO customers (
      id, customer_code, customer_name, company_name, company_name_en, customer_type,
      customer_level, customer_region, country_code, province, city, address, postal_code,
      contact_person, contact_phone, contact_email, tax_number,
      legal_person, registered_capital, establishment_date, business_scope,
      bank_name, bank_account, credit_limit, payment_terms,
      assigned_to, assigned_name, assigned_operator, assigned_operator_name, tags, notes, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    id,
    customerCode,
    data.customerName,
    data.companyName || '',
    companyNameEn,
    data.customerType || 'shipper',
    data.customerLevel || 'normal',
    data.customerRegion || 'china',
    data.countryCode || '',
    data.province || '',
    data.city || '',
    data.address || '',
    data.postalCode || '',
    data.contactPerson || '',
    data.contactPhone || '',
    data.contactEmail || '',
    data.taxNumber || '',
    data.legalPerson || '',
    data.registeredCapital || '',
    data.establishmentDate || '',
    data.businessScope || '',
    data.bankName || '',
    data.bankAccount || '',
    data.creditLimit || 0,
    data.paymentTerms || '',
    data.assignedTo || null,
    data.assignedName || '',
    data.assignedOperator || null,
    data.assignedOperatorName || '',
    data.tags ? JSON.stringify(data.tags) : '[]',
    data.notes || '',
    data.status || 'active'
  )
  
  return { id, customerCode }
}

/**
 * 更新客户
 */
export async function updateCustomer(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  // 如果更新了公司中文名称，自动重新翻译英文名称
  // 翻译服务设置了 5 秒超时，不会阻塞主流程
  if (data.companyName !== undefined && data.companyName) {
    try {
      const companyNameEn = await translateText(data.companyName, 'zh-CN', 'en')
      // 只有翻译成功且结果不同于原文时才更新
      if (companyNameEn && companyNameEn !== data.companyName) {
        console.log(`[客户更新] 自动翻译公司名称: ${data.companyName} -> ${companyNameEn}`)
        data.companyNameEn = companyNameEn
      }
    } catch (error) {
      console.warn('[客户更新] 翻译公司名称失败，跳过翻译:', error.message)
      // 翻译失败不影响其他字段更新
    }
  }
  
  const fieldMap = {
    customerName: 'customer_name',
    companyName: 'company_name',
    companyNameEn: 'company_name_en',
    customerType: 'customer_type',
    customerLevel: 'customer_level',
    customerRegion: 'customer_region',
    countryCode: 'country_code',
    province: 'province',
    city: 'city',
    address: 'address',
    postalCode: 'postal_code',
    contactPerson: 'contact_person',
    contactPhone: 'contact_phone',
    contactEmail: 'contact_email',
    taxNumber: 'tax_number',
    legalPerson: 'legal_person',
    registeredCapital: 'registered_capital',
    establishmentDate: 'establishment_date',
    businessScope: 'business_scope',
    bankName: 'bank_name',
    bankAccount: 'bank_account',
    creditLimit: 'credit_limit',
    paymentTerms: 'payment_terms',
    assignedTo: 'assigned_to',
    assignedName: 'assigned_name',
    assignedOperator: 'assigned_operator',
    assignedOperatorName: 'assigned_operator_name',
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
  
  if (fields.length === 0) {
    console.log('[客户更新] 没有需要更新的字段')
    return false
  }
  
  fields.push("updated_at = NOW()")
  values.push(id)
  
  try {
    const sql = `UPDATE customers SET ${fields.join(', ')} WHERE id = ?`
    console.log(`[客户更新] 执行SQL, 客户ID: ${id}, 更新字段数: ${fields.length - 1}`)
    const result = await db.prepare(sql).run(...values)
    console.log(`[客户更新] 更新结果: ${result.changes > 0 ? '成功' : '无变化'}`)
    return result.changes > 0
  } catch (error) {
    console.error('[客户更新] 数据库执行失败:', error.message)
    throw error // 重新抛出错误，让 controller 捕获
  }
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
      id, customer_id, contact_name, contact_type, position, department,
      phone, mobile, email, wechat, qq,
      is_primary, is_decision_maker, notes, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    id,
    data.customerId,
    data.contactName,
    data.contactType || 'other',
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
    contactType: 'contact_type',
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
 * 只使用 customer_id 精确匹配，避免名称模糊匹配导致数据混淆
 */
export async function getCustomerOrderStats(customerId) {
  const db = getDatabase()
  
  // 验证客户存在
  const customer = await getCustomerById(customerId)
  if (!customer) return null
  
  // 仅通过 customer_id 精确匹配统计订单
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
      AND customer_id = ?
  `).get(customerId)
  
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
 * 获取客户订单趋势统计（按月/年维度）
 * 同时统计两个日期维度：创建时间(create_time)和清关完成时间(customs_release_time)
 * 注意：create_time 是 TEXT 类型，需要转换为日期
 * @param {string} customerId - 客户ID
 * @param {string} dimension - 统计维度：'month' 或 'year'
 * @param {number} limit - 返回记录数，月度默认12，年度默认5
 */
export async function getCustomerOrderTrend(customerId, dimension = 'month', limit = null) {
  const db = getDatabase()
  
  // 验证客户存在
  const customer = await getCustomerById(customerId)
  if (!customer) return null
  
  // 设置默认limit
  if (!limit) {
    limit = dimension === 'month' ? 12 : 5
  }
  
  // 构建两个查询：一个按创建时间(create_time)，一个按清关完成时间(customs_release_time)
  // create_time 是 TEXT 类型，格式可能是 '2024-10-15' 或 ISO 格式
  let createdQuery, clearedQuery
  
  if (dimension === 'month') {
    // 按创建时间 - 月度统计 (使用 create_time 字段，TEXT类型需要转换)
    createdQuery = `
      SELECT 
        TO_CHAR(create_time::date, 'YYYY-MM') as period,
        EXTRACT(YEAR FROM create_time::date)::text as year,
        LPAD(EXTRACT(MONTH FROM create_time::date)::text, 2, '0') as month,
        COUNT(*) as order_count,
        COALESCE(SUM(weight), 0) as total_weight,
        COALESCE(SUM(volume), 0) as total_volume
      FROM bills_of_lading
      WHERE (is_void = 0 OR is_void IS NULL)
        AND customer_id = $1
        AND create_time IS NOT NULL
        AND create_time != ''
        AND create_time::date >= CURRENT_DATE - INTERVAL '${limit} months'
      GROUP BY TO_CHAR(create_time::date, 'YYYY-MM'), EXTRACT(YEAR FROM create_time::date), EXTRACT(MONTH FROM create_time::date)
      ORDER BY period ASC
    `
    
    // 按清关完成时间 - 月度统计
    clearedQuery = `
      SELECT 
        TO_CHAR(customs_release_time::timestamp, 'YYYY-MM') as period,
        EXTRACT(YEAR FROM customs_release_time::timestamp)::text as year,
        LPAD(EXTRACT(MONTH FROM customs_release_time::timestamp)::text, 2, '0') as month,
        COUNT(*) as order_count,
        COALESCE(SUM(weight), 0) as total_weight,
        COALESCE(SUM(volume), 0) as total_volume
      FROM bills_of_lading
      WHERE (is_void = 0 OR is_void IS NULL)
        AND customer_id = $1
        AND customs_release_time IS NOT NULL
        AND customs_release_time != ''
        AND customs_release_time::timestamp >= CURRENT_DATE - INTERVAL '${limit} months'
      GROUP BY TO_CHAR(customs_release_time::timestamp, 'YYYY-MM'), EXTRACT(YEAR FROM customs_release_time::timestamp), EXTRACT(MONTH FROM customs_release_time::timestamp)
      ORDER BY period ASC
    `
  } else {
    // 按创建时间 - 年度统计 (使用 create_time 字段)
    createdQuery = `
      SELECT 
        EXTRACT(YEAR FROM create_time::date)::text as period,
        EXTRACT(YEAR FROM create_time::date)::text as year,
        '00' as month,
        COUNT(*) as order_count,
        COALESCE(SUM(weight), 0) as total_weight,
        COALESCE(SUM(volume), 0) as total_volume
      FROM bills_of_lading
      WHERE (is_void = 0 OR is_void IS NULL)
        AND customer_id = $1
        AND create_time IS NOT NULL
        AND create_time != ''
        AND create_time::date >= CURRENT_DATE - INTERVAL '${limit} years'
      GROUP BY EXTRACT(YEAR FROM create_time::date)
      ORDER BY period ASC
    `
    
    // 按清关完成时间 - 年度统计
    clearedQuery = `
      SELECT 
        EXTRACT(YEAR FROM customs_release_time::timestamp)::text as period,
        EXTRACT(YEAR FROM customs_release_time::timestamp)::text as year,
        '00' as month,
        COUNT(*) as order_count,
        COALESCE(SUM(weight), 0) as total_weight,
        COALESCE(SUM(volume), 0) as total_volume
      FROM bills_of_lading
      WHERE (is_void = 0 OR is_void IS NULL)
        AND customer_id = $1
        AND customs_release_time IS NOT NULL
        AND customs_release_time != ''
        AND customs_release_time::timestamp >= CURRENT_DATE - INTERVAL '${limit} years'
      GROUP BY EXTRACT(YEAR FROM customs_release_time::timestamp)
      ORDER BY period ASC
    `
  }
  
  // 执行查询
  const createdRows = await db.prepare(createdQuery).all(customerId)
  const clearedRows = await db.prepare(clearedQuery).all(customerId)
  
  // 格式化创建时间数据
  const createdData = createdRows.map(row => ({
    period: row.period,
    year: row.year,
    month: row.month !== '00' ? row.month : null,
    label: dimension === 'month' 
      ? `${row.year}-${row.month}`
      : `${row.year}年`,
    orderCount: Number(row.order_count || 0),
    totalWeight: Number(row.total_weight || 0),
    totalVolume: Number(row.total_volume || 0)
  }))
  
  // 格式化清关完成时间数据
  const clearedData = clearedRows.map(row => ({
    period: row.period,
    year: row.year,
    month: row.month !== '00' ? row.month : null,
    label: dimension === 'month' 
      ? `${row.year}-${row.month}`
      : `${row.year}年`,
    orderCount: Number(row.order_count || 0),
    totalWeight: Number(row.total_weight || 0),
    totalVolume: Number(row.total_volume || 0)
  }))
  
  // 如果是月度，补充缺失的月份（确保连续性）
  if (dimension === 'month') {
    const filledCreated = []
    const filledCleared = []
    const now = new Date()
    
    for (let i = limit - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear().toString()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const period = `${year}-${month}`
      
      // 创建时间数据
      const existingCreated = createdData.find(d => d.period === period)
      if (existingCreated) {
        filledCreated.push(existingCreated)
      } else {
        filledCreated.push({
          period,
          year,
          month,
          label: `${year}-${month}`,
          orderCount: 0,
          totalWeight: 0,
          totalVolume: 0
        })
      }
      
      // 清关完成时间数据
      const existingCleared = clearedData.find(d => d.period === period)
      if (existingCleared) {
        filledCleared.push(existingCleared)
      } else {
        filledCleared.push({
          period,
          year,
          month,
          label: `${year}-${month}`,
          orderCount: 0,
          totalWeight: 0,
          totalVolume: 0
        })
      }
    }
    
    return {
      created: filledCreated,
      cleared: filledCleared
    }
  }
  
  // 年度统计，补充缺失的年份
  const filledCreated = []
  const filledCleared = []
  const currentYear = new Date().getFullYear()
  
  for (let i = limit - 1; i >= 0; i--) {
    const year = (currentYear - i).toString()
    const period = year
    
    // 创建时间数据
    const existingCreated = createdData.find(d => d.period === period)
    if (existingCreated) {
      filledCreated.push(existingCreated)
    } else {
      filledCreated.push({
        period,
        year,
        month: null,
        label: `${year}年`,
        orderCount: 0,
        totalWeight: 0,
        totalVolume: 0
      })
    }
    
    // 清关完成时间数据
    const existingCleared = clearedData.find(d => d.period === period)
    if (existingCleared) {
      filledCleared.push(existingCleared)
    } else {
      filledCleared.push({
        period,
        year,
        month: null,
        label: `${year}年`,
        orderCount: 0,
        totalWeight: 0,
        totalVolume: 0
      })
    }
  }
  
  return {
    created: filledCreated,
    cleared: filledCleared
  }
}

/**
 * 获取客户相关订单列表
 * 只使用 customer_id 精确匹配，避免名称模糊匹配导致数据混淆
 */
export async function getCustomerOrders(customerId, params = {}) {
  const db = getDatabase()
  const { page = 1, pageSize = 10, search, status } = params
  
  const customer = await getCustomerById(customerId)
  if (!customer) return { list: [], total: 0, page, pageSize }
  
  // 仅通过 customer_id 精确匹配查询订单
  let query = `
    SELECT * FROM bills_of_lading 
    WHERE is_void = 0 AND customer_id = ?
  `
  const queryParams = [customerId]
  
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
    list: list.map(row => {
      // 根据 order_seq 和创建时间生成订单号
      let orderNumber = null
      if (row.order_seq) {
        const createDate = row.created_at ? new Date(row.created_at) : new Date()
        const year = createDate.getFullYear().toString().slice(-2)
        orderNumber = `BP${year}${String(row.order_seq).padStart(5, '0')}`
      }
      return {
        id: row.id,
        orderNumber,
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
      }
    }),
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
  
  // 使用数据库自增 id，不手动传入
  const result = await db.prepare(`
    INSERT INTO customer_addresses (
      customer_id, address_code, company_name, contact_person, phone,
      country, city, address, postal_code, is_default, address_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    customerId,
    data.addressCode || null,
    data.companyName || null,
    data.contactPerson || null,
    data.phone || null,
    data.country || null,
    data.city || null,
    data.address,
    data.postalCode || null,
    data.isDefault ? 1 : 0,
    data.addressType || 'both'
  )
  
  return { id: result?.id }
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
  
  // 使用 PostgreSQL SERIAL 自动生成 id，通过 RETURNING 获取生成的 id
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
  
  return { id: result?.id }
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

// ==================== 客户公司税号信息管理（新版：每个公司一条记录） ====================

/**
 * 获取客户公司税号列表（新版）
 */
export async function getCustomerTaxInfoList(customerId) {
  const db = getDatabase()
  const rows = await db.prepare(`
    SELECT * FROM customer_tax_info 
    WHERE customer_id = ? 
    ORDER BY is_default DESC, created_at DESC
  `).all(customerId)
  
  return rows.map(row => ({
    id: row.id,
    customerId: row.customer_id,
    companyName: row.company_name,
    companyShortName: row.company_short_name,
    companyAddress: row.company_address,
    country: row.country,
    eoriNumber: row.eori_number,
    eoriVerified: row.eori_verified === 1,
    eoriVerifiedAt: row.eori_verified_at,
    vatNumber: row.vat_number,
    vatVerified: row.vat_verified === 1,
    vatVerifiedAt: row.vat_verified_at,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

/**
 * 创建客户公司税号信息（新版）
 */
export async function createCustomerTaxInfo(customerId, data) {
  const db = getDatabase()
  
  // 检查公司名是否已存在
  const existing = await db.prepare(`
    SELECT id FROM customer_tax_info 
    WHERE customer_id = ? AND company_name = ?
  `).get(customerId, data.companyName)
  
  if (existing) {
    throw new Error(`该客户已存在公司 "${data.companyName}" 的税号信息`)
  }
  
  // 如果设为默认，先取消其他默认
  if (data.isDefault) {
    await db.prepare(`
      UPDATE customer_tax_info SET is_default = 0 
      WHERE customer_id = ?
    `).run(customerId)
  }
  
  const result = await db.prepare(`
    INSERT INTO customer_tax_info (
      customer_id, company_name, company_short_name, company_address, country,
      eori_number, eori_verified, eori_verified_at,
      vat_number, vat_verified, vat_verified_at,
      is_default
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    customerId,
    data.companyName,
    data.companyShortName || null,
    data.companyAddress || null,
    data.country || null,
    data.eoriNumber || null,
    data.eoriVerified ? 1 : 0,
    data.eoriVerifiedAt || null,
    data.vatNumber || null,
    data.vatVerified ? 1 : 0,
    data.vatVerifiedAt || null,
    data.isDefault ? 1 : 0
  )
  
  return { id: result?.id }
}

/**
 * 更新客户公司税号信息（新版）
 */
export async function updateCustomerTaxInfo(taxInfoId, data) {
  const db = getDatabase()
  
  const current = await db.prepare('SELECT customer_id, company_name FROM customer_tax_info WHERE id = ?').get(taxInfoId)
  if (!current) return null
  
  // 如果修改了公司名，检查是否重复
  if (data.companyName && data.companyName !== current.company_name) {
    const existing = await db.prepare(`
      SELECT id FROM customer_tax_info 
      WHERE customer_id = ? AND company_name = ? AND id != ?
    `).get(current.customer_id, data.companyName, taxInfoId)
    
    if (existing) {
      throw new Error(`该客户已存在公司 "${data.companyName}" 的税号信息`)
    }
  }
  
  // 如果设为默认，先取消其他默认
  if (data.isDefault) {
    await db.prepare(`
      UPDATE customer_tax_info SET is_default = 0 
      WHERE customer_id = ?
    `).run(current.customer_id)
  }
  
  await db.prepare(`
    UPDATE customer_tax_info SET
      company_name = COALESCE(?, company_name),
      company_short_name = COALESCE(?, company_short_name),
      company_address = COALESCE(?, company_address),
      country = COALESCE(?, country),
      eori_number = COALESCE(?, eori_number),
      eori_verified = COALESCE(?, eori_verified),
      eori_verified_at = COALESCE(?, eori_verified_at),
      vat_number = COALESCE(?, vat_number),
      vat_verified = COALESCE(?, vat_verified),
      vat_verified_at = COALESCE(?, vat_verified_at),
      is_default = ?,
      updated_at = NOW()
    WHERE id = ?
  `).run(
    data.companyName,
    data.companyShortName,
    data.companyAddress,
    data.country,
    data.eoriNumber,
    data.eoriVerified !== undefined ? (data.eoriVerified ? 1 : 0) : null,
    data.eoriVerifiedAt,
    data.vatNumber,
    data.vatVerified !== undefined ? (data.vatVerified ? 1 : 0) : null,
    data.vatVerifiedAt,
    data.isDefault ? 1 : 0,
    taxInfoId
  )
  
  return { id: taxInfoId }
}

/**
 * 删除客户公司税号信息（新版）
 */
export async function deleteCustomerTaxInfo(taxInfoId) {
  const db = getDatabase()
  await db.prepare('DELETE FROM customer_tax_info WHERE id = ?').run(taxInfoId)
  return { success: true }
}

// ==================== 共享税号管理（公司级税号库） ====================

/**
 * 获取共享税号列表
 */
export async function getSharedTaxNumbers(params = {}) {
  const db = getDatabase()
  const { taxType, search, status, page = 1, pageSize = 50 } = params
  
  let query = 'SELECT * FROM shared_tax_numbers WHERE 1=1'
  const queryParams = []
  
  // 只有明确指定 status 且不是 'all' 时才过滤
  if (status && status !== 'all') {
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
      supplierId: row.supplier_id,
      supplierCode: row.supplier_code,
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
    supplierId: row.supplier_id,
    supplierCode: row.supplier_code,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * 生成供应商编码（IA-XXX格式）
 */
function generateSupplierCodeFromShortName(shortName) {
  if (!shortName) return null
  // 提取简称的大写字母部分，去除空格和特殊字符
  const code = shortName.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return `IA-${code}`
}

/**
 * 预定义的供应商别名映射
 */
const SUPPLIER_ALIASES = {
  'kiwi': 'IA-KIWISTAV',
  'feld': 'IA-FELDSBERG',
  'feldsberg': 'IA-FELDSBERG',
  'kralovec': 'IA-KRALOVECAI',
  'kurz': 'IA-DBWIH',
  'dbwih': 'IA-DBWIH',
  'dwgk': 'IA-DWGK',
}

/**
 * 智能匹配供应商（五级匹配）
 * 1. 精确匹配 supplier_code (IA-XXX)
 * 2. 精确匹配 short_name (不区分大小写)
 * 3. 模糊匹配 supplier_name / short_name
 * 4. 核心词匹配 (DBWIH-Test --> DBWIH --> IA-DBWIH)
 * 5. 预定义别名映射 (KIWI --> IA-KIWISTAV)
 */
async function findMatchingSupplier(db, companyShortName) {
  if (!companyShortName) return null
  
  const shortName = companyShortName.trim()
  const shortNameLower = shortName.toLowerCase()
  const generatedCode = generateSupplierCodeFromShortName(shortName)
  
  // 1. 精确匹配供应商编码 IA-XXX
  let supplier = await db.prepare(`
    SELECT id, supplier_code, supplier_name FROM suppliers 
    WHERE supplier_code = ? AND status = 'active'
  `).get(generatedCode)
  if (supplier) return supplier
  
  // 2. 精确匹配 short_name（不区分大小写）
  supplier = await db.prepare(`
    SELECT id, supplier_code, supplier_name FROM suppliers 
    WHERE LOWER(short_name) = ? AND status = 'active'
  `).get(shortNameLower)
  if (supplier) return supplier
  
  // 3. 模糊匹配 supplier_name 或 short_name
  supplier = await db.prepare(`
    SELECT id, supplier_code, supplier_name FROM suppliers 
    WHERE (LOWER(supplier_name) LIKE ? OR LOWER(short_name) LIKE ?)
      AND status = 'active'
    LIMIT 1
  `).get(`%${shortNameLower}%`, `%${shortNameLower}%`)
  if (supplier) return supplier
  
  // 4. 核心词匹配：提取第一个单词作为核心词
  const coreWord = shortName.split(/[-_\s]/)[0]
  if (coreWord && coreWord.length >= 3) {
    const coreCode = generateSupplierCodeFromShortName(coreWord)
    supplier = await db.prepare(`
      SELECT id, supplier_code, supplier_name FROM suppliers 
      WHERE (supplier_code = ? OR supplier_code LIKE ?)
        AND status = 'active'
      LIMIT 1
    `).get(coreCode, `${coreCode}%`)
    if (supplier) return supplier
  }
  
  // 5. 预定义别名映射
  const aliasCode = SUPPLIER_ALIASES[shortNameLower] || SUPPLIER_ALIASES[coreWord?.toLowerCase()]
  if (aliasCode) {
    supplier = await db.prepare(`
      SELECT id, supplier_code, supplier_name FROM suppliers 
      WHERE supplier_code = ? AND status = 'active'
    `).get(aliasCode)
    if (supplier) return supplier
  }
  
  return null // 未找到
}

/**
 * 创建共享税号（同时自动创建关联供应商）
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
  
  let supplierId = null
  let supplierCode = null
  
  // 如果有公司简称，查找或创建关联供应商
  if (data.companyShortName) {
    supplierCode = generateSupplierCodeFromShortName(data.companyShortName)
    
    // 检查供应商是否已存在
    const existingSupplier = await db.prepare(`
      SELECT id, supplier_code, supplier_name FROM suppliers WHERE supplier_code = ?
    `).get(supplierCode)
    
    if (existingSupplier) {
      // 供应商已存在，直接使用
      supplierId = existingSupplier.id
    } else {
      // 新添加时自动创建供应商
      const { v4: uuidv4 } = await import('uuid')
      supplierId = uuidv4()
      
      await db.prepare(`
        INSERT INTO suppliers (
          id, supplier_code, supplier_name, short_name, supplier_type,
          country, address, tax_number, status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'tax_agent', ?, ?, ?, 'active', ?, NOW(), NOW())
      `).run(
        supplierId,
        supplierCode,
        data.companyName || data.companyShortName,
        data.companyShortName,
        data.country || null,
        data.companyAddress || null,
        data.taxNumber,
        data.createdBy || null
      )
    }
  }
  
  const result = await db.prepare(`
    INSERT INTO shared_tax_numbers (
      tax_type, tax_number, country, company_short_name, company_name, company_address,
      is_verified, verified_at, verification_data, status, remark, created_by,
      supplier_id, supplier_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    data.createdBy || null,
    supplierId,
    supplierCode
  )
  
  return { id: result.id, supplierId, supplierCode }
}

/**
 * 更新共享税号（同时同步更新关联供应商）
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
  
  // 获取当前记录
  const current = await db.prepare('SELECT * FROM shared_tax_numbers WHERE id = ?').get(id)
  
  let supplierId = current?.supplier_id
  let supplierCode = current?.supplier_code
  
  // 如果公司简称变更，使用智能匹配查找对应供应商
  if (data.companyShortName && data.companyShortName !== current?.company_short_name) {
    // 使用五级智能匹配查找供应商
    const matchedSupplier = await findMatchingSupplier(db, data.companyShortName)
    
    if (matchedSupplier) {
      supplierId = matchedSupplier.id
      supplierCode = matchedSupplier.supplier_code
    } else {
      // 匹配不上，提示管理员先创建
      const expectedCode = generateSupplierCodeFromShortName(data.companyShortName)
      throw new Error(`未找到匹配的供应商 [${expectedCode}]，请先在"供应商管理"中创建编码为 ${expectedCode} 的供应商，再修改共享税号。`)
    }
  }
  
  // 如果有关联供应商，同步更新供应商信息
  if (supplierId) {
    await db.prepare(`
      UPDATE suppliers SET
        supplier_name = COALESCE(?, supplier_name),
        short_name = COALESCE(?, short_name),
        country = COALESCE(?, country),
        address = COALESCE(?, address),
        updated_at = NOW()
      WHERE id = ?
    `).run(
      data.companyName,
      data.companyShortName,
      data.country,
      data.companyAddress,
      supplierId
    )
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
      supplier_id = COALESCE(?, supplier_id),
      supplier_code = COALESCE(?, supplier_code),
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
    supplierId,
    supplierCode,
    id
  )
  
  return { id, supplierId, supplierCode }
}

/**
 * 删除共享税号
 */
/**
 * 作废共享税号（不删除，只修改状态）
 */
export async function voidSharedTaxNumber(id) {
  const db = getDatabase()
  await db.prepare(`
    UPDATE shared_tax_numbers 
    SET status = 'voided', 
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(id)
  return { success: true }
}

/**
 * 恢复已作废的共享税号
 */
export async function restoreSharedTaxNumber(id) {
  const db = getDatabase()
  await db.prepare(`
    UPDATE shared_tax_numbers 
    SET status = 'active', 
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(id)
  return { success: true }
}

// ==================== 共享税号使用统计 ====================

/**
 * 记录共享税号使用
 * @param {Object} data - 使用记录数据
 * @param {number} data.sharedTaxId - 共享税号ID
 * @param {string} data.billId - 提单ID
 * @param {string} data.billNumber - 提单号
 * @param {string} data.containerNumber - 集装箱号
 * @param {string} data.transportType - 运输类型 (sea/air/rail/truck)
 * @param {number} data.quantity - 数量（空运为公斤，其他为柜数）
 * @param {string} data.customerId - 客户ID
 * @param {string} data.customerName - 客户名称
 * @param {string} data.createdBy - 创建人
 */
export async function recordSharedTaxUsage(data) {
  const db = getDatabase()
  
  // 确定使用月份
  const usageMonth = data.usageMonth || new Date().toISOString().slice(0, 7) // YYYY-MM
  
  // 确定单位：空运用公斤，其他用柜
  const unit = data.transportType === 'air' ? 'kg' : 'container'
  
  // 检查是否已存在该提单的使用记录
  const existing = await db.prepare(`
    SELECT id FROM shared_tax_usage WHERE bill_id = ?
  `).get(data.billId)
  
  if (existing) {
    // 更新现有记录
    await db.prepare(`
      UPDATE shared_tax_usage SET
        shared_tax_id = ?,
        bill_number = ?,
        container_number = ?,
        usage_month = ?,
        transport_type = ?,
        quantity = ?,
        unit = ?,
        customer_id = ?,
        customer_name = ?,
        updated_at = NOW()
      WHERE bill_id = ?
    `).run(
      data.sharedTaxId,
      data.billNumber || null,
      data.containerNumber || null,
      usageMonth,
      data.transportType || 'sea',
      data.quantity || 1,
      unit,
      data.customerId || null,
      data.customerName || null,
      data.billId
    )
    return { id: existing.id, updated: true }
  }
  
  // 创建新记录
  const result = await db.prepare(`
    INSERT INTO shared_tax_usage (
      shared_tax_id, bill_id, bill_number, container_number,
      usage_month, transport_type, quantity, unit,
      customer_id, customer_name, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    data.sharedTaxId,
    data.billId,
    data.billNumber || null,
    data.containerNumber || null,
    usageMonth,
    data.transportType || 'sea',
    data.quantity || 1,
    unit,
    data.customerId || null,
    data.customerName || null,
    data.createdBy || null
  )
  
  // 同时更新提单表的共享税号ID
  await db.prepare(`
    UPDATE bills_of_lading SET shared_tax_id = ?, updated_at = NOW() WHERE id = ?
  `).run(data.sharedTaxId, data.billId)
  
  return { id: result?.id, created: true }
}

/**
 * 删除共享税号使用记录
 */
export async function deleteSharedTaxUsage(billId) {
  const db = getDatabase()
  await db.prepare('DELETE FROM shared_tax_usage WHERE bill_id = ?').run(billId)
  // 同时清除提单表的共享税号ID
  await db.prepare('UPDATE bills_of_lading SET shared_tax_id = NULL WHERE id = ?').run(billId)
  return { success: true }
}

/**
 * 获取共享税号使用记录列表
 */
export async function getSharedTaxUsageList(params = {}) {
  const db = getDatabase()
  const { sharedTaxId, month, transportType, page = 1, pageSize = 50 } = params
  
  let query = `
    SELECT stu.*, stn.company_name as tax_company_name, stn.tax_number, stn.tax_type
    FROM shared_tax_usage stu
    LEFT JOIN shared_tax_numbers stn ON stu.shared_tax_id = stn.id
    WHERE 1=1
  `
  const queryParams = []
  
  if (sharedTaxId) {
    query += ' AND stu.shared_tax_id = ?'
    queryParams.push(sharedTaxId)
  }
  
  if (month) {
    query += ' AND stu.usage_month = ?'
    queryParams.push(month)
  }
  
  if (transportType) {
    query += ' AND stu.transport_type = ?'
    queryParams.push(transportType)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT stu.*, stn.company_name as tax_company_name, stn.tax_number, stn.tax_type', 'SELECT COUNT(*) as total')
  const countResult = await db.prepare(countQuery).get(...queryParams)
  const total = countResult?.total || 0
  
  // 分页
  query += ' ORDER BY stu.created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const rows = await db.prepare(query).all(...queryParams)
  
  return {
    list: rows.map(row => ({
      id: row.id,
      sharedTaxId: row.shared_tax_id,
      taxCompanyName: row.tax_company_name,
      taxNumber: row.tax_number,
      taxType: row.tax_type,
      billId: row.bill_id,
      billNumber: row.bill_number,
      containerNumber: row.container_number,
      usageMonth: row.usage_month,
      transportType: row.transport_type,
      quantity: row.quantity,
      unit: row.unit,
      customerId: row.customer_id,
      customerName: row.customer_name,
      createdAt: row.created_at
    })),
    total,
    page,
    pageSize
  }
}

/**
 * 获取共享税号月度使用统计
 * @param {Object} params
 * @param {number} params.sharedTaxId - 可选，指定共享税号ID
 * @param {string} params.month - 可选，指定月份 YYYY-MM
 * @param {string} params.year - 可选，指定年份 YYYY
 */
export async function getSharedTaxUsageStats(params = {}) {
  const db = getDatabase()
  const { sharedTaxId, month, year } = params
  
  let query = `
    SELECT 
      stn.id as shared_tax_id,
      stn.company_name,
      stn.company_short_name,
      stn.tax_number,
      stn.tax_type,
      stu.usage_month,
      stu.transport_type,
      COUNT(*) as usage_count,
      SUM(CASE WHEN stu.transport_type = 'air' THEN stu.quantity ELSE 0 END) as air_kg,
      SUM(CASE WHEN stu.transport_type != 'air' THEN stu.quantity ELSE 0 END) as container_count
    FROM shared_tax_numbers stn
    LEFT JOIN shared_tax_usage stu ON stn.id = stu.shared_tax_id
    WHERE stn.status = 'active'
  `
  const queryParams = []
  
  if (sharedTaxId) {
    query += ' AND stn.id = ?'
    queryParams.push(sharedTaxId)
  }
  
  if (month) {
    query += ' AND stu.usage_month = ?'
    queryParams.push(month)
  } else if (year) {
    query += ' AND stu.usage_month LIKE ?'
    queryParams.push(`${year}-%`)
  }
  
  query += ' GROUP BY stn.id, stn.company_name, stn.company_short_name, stn.tax_number, stn.tax_type, stu.usage_month, stu.transport_type'
  query += ' ORDER BY stn.company_name, stu.usage_month DESC'
  
  const rows = await db.prepare(query).all(...queryParams)
  
  return rows.map(row => ({
    sharedTaxId: row.shared_tax_id,
    companyName: row.company_name,
    companyShortName: row.company_short_name,
    taxNumber: row.tax_number,
    taxType: row.tax_type,
    usageMonth: row.usage_month,
    transportType: row.transport_type,
    usageCount: row.usage_count || 0,
    airKg: parseFloat(row.air_kg) || 0,
    containerCount: parseFloat(row.container_count) || 0
  }))
}

/**
 * 获取共享税号汇总统计（按公司/供应商汇总）
 * 基于应付费用数据，按清关完成月份统计
 * 统计有应付费用给该供应商的提单：
 * - 海运/铁路/卡航：按柜数统计（container_count，默认1）
 * - 空运：按公斤统计（gross_weight）
 */
export async function getSharedTaxUsageSummary(params = {}) {
  const db = getDatabase()
  const { month, year } = params
  
  // 直接从 suppliers 表获取所有 IA- 开头的清关代理供应商
  // 这样可以统计所有清关代理的费用，包括没有在 shared_tax_numbers 表中记录的
  const suppliers = await db.prepare(`
    SELECT 
      s.id as supplier_id,
      s.supplier_code,
      s.supplier_name,
      s.short_name
    FROM suppliers s
    WHERE s.supplier_code LIKE 'IA-%'
      AND s.status = 'active'
    ORDER BY s.supplier_code
  `).all()
  
  const results = []
  
  for (const supplier of suppliers) {
    // 查询该供应商在指定月份的应付费用关联的提单
    // 每条提单记录 = 1个集装箱（海运/铁路/卡航）或按weight计算（空运）
    let billQuery = `
      SELECT DISTINCT 
        b.id,
        COALESCE(b.transport_method, '海运') as transport_method,
        COALESCE(b.weight, 0) as weight
      FROM fees f
      INNER JOIN bills_of_lading b ON f.bill_id = b.id
      WHERE f.fee_type = 'payable' 
        AND f.supplier_id = ?
        AND (b.is_void = 0 OR b.is_void IS NULL)
    `
    const billParams = [supplier.supplier_id]
    
    // 按清关完成月份筛选
    if (month) {
      billQuery += ` AND b.customs_release_time IS NOT NULL AND b.customs_release_time != '' AND TO_CHAR(b.customs_release_time::timestamp, 'YYYY-MM') = ?`
      billParams.push(month)
    } else if (year) {
      billQuery += ` AND b.customs_release_time IS NOT NULL AND b.customs_release_time != '' AND TO_CHAR(b.customs_release_time::timestamp, 'YYYY') = ?`
      billParams.push(year)
    }
    
    const bills = await db.prepare(billQuery).all(...billParams)
    
    // 统计各运输类型
    // 海运/铁路/卡航：每条提单 = 1个集装箱
    // 空运：按 weight 字段累计公斤数，同时统计空运提单数
    let totalAirKg = 0
    let totalAirBills = 0  // 空运提单数（独立统计）
    let totalSeaContainers = 0
    let totalRailContainers = 0
    let totalTruckContainers = 0
    
    for (const bill of bills) {
      const method = bill.transport_method
      if (method === '空运') {
        // 空运按公斤统计，同时记录提单数
        totalAirKg += parseFloat(bill.weight) || 0
        totalAirBills += 1
      } else if (method === '海运') {
        totalSeaContainers += 1  // 每条提单 = 1个集装箱
      } else if (method === '铁路' || method === '铁运') {
        totalRailContainers += 1
      } else if (method === '卡航') {
        totalTruckContainers += 1
      } else {
        // 默认算作海运
        totalSeaContainers += 1
      }
    }
    
    // 提单数 = 柜子类运输的总数（海运+铁路+卡航），不包括空运
    const totalBills = totalSeaContainers + totalRailContainers + totalTruckContainers
    
    // 查询该供应商在指定月份的应付金额（分别统计柜子类和空运）
    // 柜子类（海运/铁路/卡航）应付金额
    let containerAmountQuery = `
      SELECT COALESCE(SUM(f.amount), 0) as total_amount
      FROM fees f
      INNER JOIN bills_of_lading b ON f.bill_id = b.id
      WHERE f.fee_type = 'payable' 
        AND f.supplier_id = ?
        AND (b.is_void = 0 OR b.is_void IS NULL)
        AND (COALESCE(b.transport_method, '海运') != '空运')
    `
    const containerAmountParams = [supplier.supplier_id]
    
    if (month) {
      containerAmountQuery += ` AND b.customs_release_time IS NOT NULL AND b.customs_release_time != '' AND TO_CHAR(b.customs_release_time::timestamp, 'YYYY-MM') = ?`
      containerAmountParams.push(month)
    } else if (year) {
      containerAmountQuery += ` AND b.customs_release_time IS NOT NULL AND b.customs_release_time != '' AND TO_CHAR(b.customs_release_time::timestamp, 'YYYY') = ?`
      containerAmountParams.push(year)
    }
    
    const containerAmountResult = await db.prepare(containerAmountQuery).get(...containerAmountParams)
    const containerPayableAmount = parseFloat(containerAmountResult?.total_amount) || 0
    
    // 空运应付金额
    let airAmountQuery = `
      SELECT COALESCE(SUM(f.amount), 0) as total_amount
      FROM fees f
      INNER JOIN bills_of_lading b ON f.bill_id = b.id
      WHERE f.fee_type = 'payable' 
        AND f.supplier_id = ?
        AND (b.is_void = 0 OR b.is_void IS NULL)
        AND b.transport_method = '空运'
    `
    const airAmountParams = [supplier.supplier_id]
    
    if (month) {
      airAmountQuery += ` AND b.customs_release_time IS NOT NULL AND b.customs_release_time != '' AND TO_CHAR(b.customs_release_time::timestamp, 'YYYY-MM') = ?`
      airAmountParams.push(month)
    } else if (year) {
      airAmountQuery += ` AND b.customs_release_time IS NOT NULL AND b.customs_release_time != '' AND TO_CHAR(b.customs_release_time::timestamp, 'YYYY') = ?`
      airAmountParams.push(year)
    }
    
    const airAmountResult = await db.prepare(airAmountQuery).get(...airAmountParams)
    const airPayableAmount = parseFloat(airAmountResult?.total_amount) || 0
    
    // 总应付金额
    const totalPayableAmount = containerPayableAmount + airPayableAmount
    
    // 从 shared_tax_numbers 表获取关联的税号信息
    const taxNumbersResult = await db.prepare(`
      SELECT DISTINCT tax_type, tax_number
      FROM shared_tax_numbers
      WHERE supplier_id = ? AND status = 'active'
    `).all(supplier.supplier_id)
    
    const taxNumbers = taxNumbersResult.map(row => ({
      type: row.tax_type,
      number: row.tax_number
    }))
    
    results.push({
      companyName: supplier.supplier_name,
      companyShortName: supplier.short_name,
      supplierCode: supplier.supplier_code,
      supplierId: supplier.supplier_id,
      taxNumbers,
      totalBills,
      totalAirKg,
      totalAirBills,
      totalSeaContainers,
      totalRailContainers,
      totalTruckContainers,
      containerPayableAmount,  // 柜子类应付金额
      airPayableAmount,        // 空运应付金额
      totalPayableAmount       // 总应付金额
    })
  }
  
  // 按应付金额降序排序
  results.sort((a, b) => b.totalPayableAmount - a.totalPayableAmount)
  
  return results
}

/**
 * 获取单个共享税号的详细统计
 */
export async function getSharedTaxDetailStats(sharedTaxId, params = {}) {
  const db = getDatabase()
  const { year } = params
  const targetYear = year || new Date().getFullYear().toString()
  
  // 获取税号基本信息
  const taxInfo = await db.prepare('SELECT * FROM shared_tax_numbers WHERE id = ?').get(sharedTaxId)
  if (!taxInfo) return null
  
  // 获取月度统计
  const monthlyQuery = `
    SELECT 
      usage_month,
      transport_type,
      COUNT(*) as count,
      SUM(quantity) as total_quantity
    FROM shared_tax_usage
    WHERE shared_tax_id = ? AND usage_month LIKE ?
    GROUP BY usage_month, transport_type
    ORDER BY usage_month DESC
  `
  const monthlyStats = await db.prepare(monthlyQuery).all(sharedTaxId, `${targetYear}-%`)
  
  // 汇总各月数据
  const monthlyData = {}
  monthlyStats.forEach(row => {
    if (!monthlyData[row.usage_month]) {
      monthlyData[row.usage_month] = {
        month: row.usage_month,
        airKg: 0,
        seaContainers: 0,
        railContainers: 0,
        truckContainers: 0,
        totalBills: 0
      }
    }
    monthlyData[row.usage_month].totalBills += row.count
    if (row.transport_type === 'air') {
      monthlyData[row.usage_month].airKg += parseFloat(row.total_quantity) || 0
    } else if (row.transport_type === 'sea') {
      monthlyData[row.usage_month].seaContainers += parseFloat(row.total_quantity) || 0
    } else if (row.transport_type === 'rail') {
      monthlyData[row.usage_month].railContainers += parseFloat(row.total_quantity) || 0
    } else if (row.transport_type === 'truck') {
      monthlyData[row.usage_month].truckContainers += parseFloat(row.total_quantity) || 0
    }
  })
  
  return {
    taxInfo: {
      id: taxInfo.id,
      taxType: taxInfo.tax_type,
      taxNumber: taxInfo.tax_number,
      companyName: taxInfo.company_name,
      companyShortName: taxInfo.company_short_name,
      country: taxInfo.country
    },
    year: targetYear,
    monthlyStats: Object.values(monthlyData).sort((a, b) => b.month.localeCompare(a.month))
  }
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
    data.currency || 'EUR',
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
  
  // 日期字段列表（空字符串需要转为 null）
  const dateFields = ['quoteDate', 'validUntil']
  
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
      // 日期字段空字符串转为 null，PostgreSQL 不接受空字符串
      let value = data[jsField]
      if (dateFields.includes(jsField) && value === '') {
        value = null
      }
      values.push(value)
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

/**
 * 作废报价
 */
export async function voidQuotation(id, reason, voidBy, voidByName) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const result = await db.prepare(`
    UPDATE quotations 
    SET is_void = TRUE,
        void_reason = ?,
        void_time = ?,
        void_by = ?,
        void_by_name = ?,
        updated_at = ?
    WHERE id = ?
  `).run(reason, now, voidBy, voidByName, now, id)
  
  return result.changes > 0
}

/**
 * 恢复已作废的报价
 */
export async function restoreQuotation(id) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const result = await db.prepare(`
    UPDATE quotations 
    SET is_void = FALSE,
        void_reason = NULL,
        void_time = NULL,
        void_by = NULL,
        void_by_name = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(now, id)
  
  return result.changes > 0
}

/**
 * 为新客户自动创建报价单
 * @param {Object} options - 报价选项
 * @param {string} options.customerId - 客户ID
 * @param {string} options.customerName - 客户名称
 * @param {string} options.productId - 产品ID
 * @param {Array<number>} options.selectedFeeItemIds - 选中的费用项ID列表
 * @param {Object} options.user - 创建人信息
 * @returns {Promise<Object>} - 报价单信息
 */
export async function createQuotationForCustomer({ customerId, customerName, productId, selectedFeeItemIds, user }) {
  const db = getDatabase()
  const id = generateId()
  const quoteNumber = await generateQuoteNumber()
  
  // 获取产品信息
  const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(productId)
  if (!product) {
    throw new Error('产品不存在')
  }
  
  // 获取选中的费用项
  let feeItems = []
  if (selectedFeeItemIds && selectedFeeItemIds.length > 0) {
    const placeholders = selectedFeeItemIds.map(() => '?').join(',')
    feeItems = await db.prepare(`
      SELECT * FROM product_fee_items 
      WHERE product_id = ? AND id IN (${placeholders})
      ORDER BY sort_order, id
    `).all(productId, ...selectedFeeItemIds)
  }
  
  // 构建报价明细
  const items = feeItems.map(item => {
    const price = parseFloat(item.standard_price) || 0
    return {
      name: item.fee_name,
      nameEn: item.fee_name_en || '',
      description: item.description || '',
      quantity: 1,
      unit: item.unit || '',
      price: price,
      amount: price,
      productId: productId,
      feeItemId: item.id
    }
  })
  
  // 计算总金额
  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.amount) || 0, 0)
  const totalAmount = subtotal
  
  // 设置报价日期和有效期（30天）
  const quoteDate = new Date().toISOString().split('T')[0]
  const validUntilDate = new Date()
  validUntilDate.setDate(validUntilDate.getDate() + 30)
  const validUntil = validUntilDate.toISOString().split('T')[0]
  
  // 报价主题
  const subject = `${customerName} - ${product.product_name || '服务报价'}`
  
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
    customerId,
    customerName,
    null,  // opportunityId
    null,  // contactId
    '',    // contactName
    subject,
    quoteDate,
    validUntil,
    subtotal,
    0,     // discount
    0,     // taxAmount
    totalAmount,
    'EUR',
    '',    // terms
    '自动生成的客户报价单',  // notes
    JSON.stringify(items),
    'draft',
    user?.id || null,
    user?.name || '系统'
  )
  
  return { 
    id, 
    quoteNumber,
    subject,
    quoteDate,
    validUntil,
    totalAmount,
    items,
    customerId,
    customerName
  }
}

// ==================== 报价费用项选择（用于新增费用） ====================

/**
 * 获取客户已确认的报价单列表（用于新增费用时选择）
 * @param {string} customerId - 客户ID
 * @returns {Promise<Array>} - 报价单列表（只返回已确认的报价单）
 */
export async function getCustomerConfirmedQuotations(customerId) {
  const db = getDatabase()
  
  // 获取该客户所有已确认（accepted）或已发送（sent）的报价单
  const quotations = await db.prepare(`
    SELECT id, quote_number, customer_name, subject, quote_date, valid_until,
           total_amount, currency, items, status, created_by_name
    FROM quotations 
    WHERE customer_id = ? AND status IN ('accepted', 'sent')
    ORDER BY quote_date DESC
  `).all(customerId)
  
  return (quotations || []).map(q => {
    // 解析 items JSON
    let items = []
    try {
      items = q.items ? JSON.parse(q.items) : []
    } catch (e) {
      items = []
    }
    
    return {
      id: q.id,
      quoteNumber: q.quote_number,
      customerName: q.customer_name,
      subject: q.subject,
      quoteDate: q.quote_date,
      validUntil: q.valid_until,
      totalAmount: parseFloat(q.total_amount) || 0,
      currency: q.currency || 'EUR',
      status: q.status,
      createdByName: q.created_by_name,
      // 费用明细项
      items: items.map((item, index) => ({
        id: `${q.id}-item-${index}`,
        name: item.name || item.feeName || '',
        nameEn: item.nameEn || item.feeNameEn || '',
        description: item.description || '',
        quantity: item.quantity || 1,
        unit: item.unit || '',
        price: parseFloat(item.price) || 0,
        amount: parseFloat(item.amount) || 0,
        feeCategory: item.feeCategory || item.category || 'other'
      }))
    }
  })
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
    data.currency || 'EUR',
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

// ==================== 合同签署管理 ====================

/**
 * 为销售机会自动生成合同
 * @param {Object} opportunityData - 销售机会数据
 * @param {Object} user - 操作用户
 */
export async function generateContractForOpportunity(opportunityData, user) {
  const db = getDatabase()
  const id = generateId()
  const contractNumber = await generateContractNumber()
  
  // 生成合同名称
  const contractName = `${opportunityData.customerName || '客户'} - 服务合同`
  
  await db.prepare(`
    INSERT INTO contracts (
      id, contract_number, contract_name, customer_id, customer_name,
      opportunity_id, contract_type, contract_amount, currency,
      status, sign_status, auto_generated,
      created_by, created_by_name,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    id,
    contractNumber,
    contractName,
    opportunityData.customerId || null,
    opportunityData.customerName || '',
    opportunityData.opportunityId,
    'service',
    opportunityData.expectedValue || 0,
    'EUR',
    'draft',
    'pending_sign',  // 待签署状态
    true,            // 自动生成标记
    user?.id || null,
    user?.name || '系统'
  )
  
  // 记录签署历史
  await addContractSignHistory(id, 'generate', '自动生成合同', user?.id, user?.name, null, 'pending_sign', null, `从销售机会 ${opportunityData.opportunityName} 自动生成`)
  
  return { id, contractNumber }
}

/**
 * 上传已签署合同
 * @param {string} contractId - 合同ID
 * @param {Object} fileData - 文件数据
 * @param {Object} user - 签署人
 */
export async function uploadSignedContract(contractId, fileData, user) {
  const db = getDatabase()
  
  const contract = await getContractById(contractId)
  if (!contract) {
    throw new Error('合同不存在')
  }
  
  const oldStatus = contract.signStatus
  
  await db.prepare(`
    UPDATE contracts SET
      signed_file_path = ?,
      signed_file_name = ?,
      signed_at = NOW(),
      signed_by = ?,
      signed_by_name = ?,
      sign_status = 'signed',
      status = 'active',
      updated_at = NOW()
    WHERE id = ?
  `).run(
    fileData.filePath,
    fileData.fileName,
    user?.id || null,
    user?.name || '系统',
    contractId
  )
  
  // 记录签署历史
  await addContractSignHistory(
    contractId, 
    'sign', 
    '上传已签署合同', 
    user?.id, 
    user?.name, 
    oldStatus, 
    'signed', 
    fileData.filePath,
    `签署人: ${user?.name || '系统'}`
  )
  
  return true
}

/**
 * 更新合同签署状态
 */
export async function updateContractSignStatus(contractId, signStatus, user, remark = '') {
  const db = getDatabase()
  
  const contract = await getContractById(contractId)
  if (!contract) {
    throw new Error('合同不存在')
  }
  
  const oldStatus = contract.signStatus
  
  await db.prepare(`
    UPDATE contracts SET sign_status = ?, updated_at = NOW() WHERE id = ?
  `).run(signStatus, contractId)
  
  // 记录历史
  const actionMap = {
    'pending_sign': 'send',
    'signed': 'sign',
    'rejected': 'reject',
    'unsigned': 'reset'
  }
  const actionNameMap = {
    'pending_sign': '发送待签署',
    'signed': '完成签署',
    'rejected': '拒绝签署',
    'unsigned': '重置状态'
  }
  
  await addContractSignHistory(
    contractId,
    actionMap[signStatus] || 'update',
    actionNameMap[signStatus] || '更新签署状态',
    user?.id,
    user?.name,
    oldStatus,
    signStatus,
    null,
    remark
  )
  
  return true
}

/**
 * 添加合同签署历史记录
 */
async function addContractSignHistory(contractId, action, actionName, operatorId, operatorName, oldStatus, newStatus, filePath, remark) {
  const db = getDatabase()
  
  await db.prepare(`
    INSERT INTO contract_sign_history (
      contract_id, action, action_name, operator_id, operator_name,
      old_status, new_status, file_path, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    contractId,
    action,
    actionName,
    operatorId || null,
    operatorName || '系统',
    oldStatus || null,
    newStatus,
    filePath || null,
    remark || null
  )
}

/**
 * 获取合同签署历史
 */
export async function getContractSignHistory(contractId) {
  const db = getDatabase()
  const history = await db.prepare(`
    SELECT * FROM contract_sign_history 
    WHERE contract_id = ? 
    ORDER BY created_at DESC
  `).all(contractId)
  
  return history.map(h => ({
    id: h.id,
    contractId: h.contract_id,
    action: h.action,
    actionName: h.action_name,
    operatorId: h.operator_id,
    operatorName: h.operator_name,
    oldStatus: h.old_status,
    newStatus: h.new_status,
    filePath: h.file_path,
    remark: h.remark,
    createTime: h.created_at
  }))
}

/**
 * 根据销售机会ID获取合同
 */
export async function getContractByOpportunityId(opportunityId) {
  const db = getDatabase()
  const contract = await db.prepare('SELECT * FROM contracts WHERE opportunity_id = ?').get(opportunityId)
  return contract ? convertContractToCamelCase(contract) : null
}

/**
 * 获取客户的待签署合同
 */
export async function getPendingSignContracts(customerId) {
  const db = getDatabase()
  const contracts = await db.prepare(`
    SELECT * FROM contracts 
    WHERE customer_id = ? AND sign_status = 'pending_sign'
    ORDER BY created_at DESC
  `).all(customerId)
  
  return contracts.map(convertContractToCamelCase)
}

/**
 * 检查销售机会是否可以成交（合同已签署）
 */
export async function canOpportunityClose(opportunityId) {
  const db = getDatabase()
  
  // 获取销售机会
  const opportunity = await db.prepare('SELECT * FROM sales_opportunities WHERE id = ?').get(opportunityId)
  if (!opportunity) {
    return { canClose: false, reason: '销售机会不存在' }
  }
  
  // 检查是否需要合同
  if (opportunity.require_contract === false) {
    return { canClose: true, reason: '该机会无需合同' }
  }
  
  // 检查是否有关联合同
  const contract = await getContractByOpportunityId(opportunityId)
  if (!contract) {
    return { 
      canClose: false, 
      reason: '尚未生成合同，请先生成合同',
      needGenerateContract: true 
    }
  }
  
  // 检查合同签署状态
  if (contract.signStatus !== 'signed') {
    const statusText = {
      'unsigned': '合同尚未发起签署',
      'pending_sign': '合同待签署，请上传已签署的合同文件',
      'rejected': '合同已被拒签，请重新处理'
    }
    return { 
      canClose: false, 
      reason: statusText[contract.signStatus] || '合同未签署',
      contract,
      needSign: contract.signStatus === 'pending_sign'
    }
  }
  
  return { 
    canClose: true, 
    reason: '合同已签署，可以成交',
    contract 
  }
}

/**
 * 更新销售机会的合同关联
 */
export async function updateOpportunityContract(opportunityId, contractId, contractNumber) {
  const db = getDatabase()
  await db.prepare(`
    UPDATE sales_opportunities 
    SET contract_id = ?, contract_number = ?, updated_at = NOW()
    WHERE id = ?
  `).run(contractId, contractNumber, opportunityId)
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
    companyNameEn: row.company_name_en,
    customerType: row.customer_type,
    customerLevel: row.customer_level,
    customerRegion: row.customer_region || 'china',
    countryCode: row.country_code,
    province: row.province,
    city: row.city,
    address: row.address,
    postalCode: row.postal_code,
    contactPerson: row.contact_person,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    taxNumber: row.tax_number,
    legalPerson: row.legal_person,
    registeredCapital: row.registered_capital,
    establishmentDate: row.establishment_date,
    businessScope: row.business_scope,
    bankName: row.bank_name,
    bankAccount: row.bank_account,
    creditLimit: row.credit_limit,
    paymentTerms: row.payment_terms,
    assignedTo: row.assigned_to,
    assignedName: row.assigned_name,
    assignedOperator: row.assigned_operator,
    assignedOperatorName: row.assigned_operator_name,
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
    contactType: row.contact_type || 'other',
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
    updateTime: row.updated_at,
    // 作废相关字段
    isVoid: row.is_void || false,
    voidReason: row.void_reason,
    voidTime: row.void_time,
    voidBy: row.void_by,
    voidByName: row.void_by_name
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
    // 签署相关字段
    signStatus: row.sign_status || 'unsigned',
    signedFilePath: row.signed_file_path,
    signedFileName: row.signed_file_name,
    signedAt: row.signed_at,
    signedBy: row.signed_by,
    signedByName: row.signed_by_name,
    contractFilePath: row.contract_file_path,
    templateId: row.template_id,
    autoGenerated: row.auto_generated,
    // 基础字段
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

// ==================== 客户门户账户管理 ====================

/**
 * 客户门户账户状态常量
 */
export const ACCOUNT_STATUS = {
  ACTIVE: 'active',       // 正常
  INACTIVE: 'inactive',   // 禁用
  LOCKED: 'locked'        // 锁定
}

/**
 * API 权限常量
 */
export const API_PERMISSIONS = {
  ORDER_CREATE: 'order:create',     // 创建订单
  ORDER_READ: 'order:read',         // 查询订单
  ORDER_UPDATE: 'order:update',     // 更新订单
  INVOICE_READ: 'invoice:read',     // 查询账单
  BALANCE_READ: 'balance:read',     // 查询余额
  WEBHOOK_MANAGE: 'webhook:manage'  // 管理Webhook
}

/**
 * 获取客户门户账户列表
 */
export async function getCustomerAccounts(params = {}) {
  const db = getDatabase()
  const { customerId, status, keyword, page = 1, pageSize = 20 } = params
  
  let sql = `
    SELECT ca.*, c.customer_name, c.customer_code
    FROM customer_accounts ca
    LEFT JOIN customers c ON ca.customer_id = c.id::text
    WHERE 1=1
  `
  const conditions = []
  
  if (customerId) {
    sql += ` AND ca.customer_id = ?`
    conditions.push(customerId)
  }
  if (status) {
    sql += ` AND ca.status = ?`
    conditions.push(status)
  }
  if (keyword) {
    sql += ` AND (ca.username LIKE ? OR ca.email LIKE ? OR c.customer_name LIKE ?)`
    conditions.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  }
  
  // 计数
  const countSql = sql.replace('SELECT ca.*, c.customer_name, c.customer_code', 'SELECT COUNT(*) as total')
  const countResult = await db.prepare(countSql).get(...conditions)
  
  // 分页
  sql += ` ORDER BY ca.created_at DESC LIMIT ? OFFSET ?`
  conditions.push(pageSize, (page - 1) * pageSize)
  
  const rows = await db.prepare(sql).all(...conditions)
  
  return {
    list: rows.map(convertAccountToCamelCase),
    total: countResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 根据ID获取客户账户
 */
export async function getCustomerAccountById(id) {
  const db = getDatabase()
  const row = await db.prepare(`
    SELECT ca.*, c.customer_name, c.customer_code
    FROM customer_accounts ca
    LEFT JOIN customers c ON ca.customer_id = c.id::text
    WHERE ca.id = ?
  `).get(id)
  
  return row ? convertAccountToCamelCase(row) : null
}

/**
 * 根据用户名获取客户账户（用于登录验证）
 */
export async function getCustomerAccountByUsername(username) {
  const db = getDatabase()
  const row = await db.prepare(`
    SELECT ca.*, c.customer_name, c.customer_code, c.id as customer_id
    FROM customer_accounts ca
    LEFT JOIN customers c ON ca.customer_id = c.id::text
    WHERE ca.username = ?
  `).get(username)
  
  return row ? convertAccountToCamelCase(row) : null
}

/**
 * 创建客户门户账户
 */
export async function createCustomerAccount(data) {
  const db = getDatabase()
  const { customerId, username, password, email, phone, createdBy } = data
  
  // 检查用户名是否已存在
  const existing = await db.prepare('SELECT id FROM customer_accounts WHERE username = ?').get(username)
  if (existing) {
    throw new Error('用户名已存在')
  }
  
  // 检查客户是否已有账户
  const existingCustomer = await db.prepare('SELECT id FROM customer_accounts WHERE customer_id = ?').get(customerId)
  if (existingCustomer) {
    throw new Error('该客户已有门户账户')
  }
  
  // 密码加密
  const passwordHash = await bcrypt.hash(password, 10)
  
  const result = await db.prepare(`
    INSERT INTO customer_accounts (customer_id, username, password_hash, email, phone, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())
  `).run(customerId, username, passwordHash, email || null, phone || null, createdBy || null)
  
  return { id: result.lastInsertRowid }
}

/**
 * 更新客户门户账户
 */
export async function updateCustomerAccount(id, data) {
  const db = getDatabase()
  const { email, phone, status } = data
  
  const updates = ['updated_at = NOW()']
  const values = []
  
  if (email !== undefined) {
    updates.push('email = ?')
    values.push(email)
  }
  if (phone !== undefined) {
    updates.push('phone = ?')
    values.push(phone)
  }
  if (status !== undefined) {
    updates.push('status = ?')
    values.push(status)
    // 如果重新激活，清除锁定状态
    if (status === 'active') {
      updates.push('login_attempts = 0')
      updates.push('locked_until = NULL')
    }
  }
  
  values.push(id)
  
  await db.prepare(`UPDATE customer_accounts SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  return true
}

/**
 * 重置客户账户密码
 */
export async function resetCustomerAccountPassword(id, newPassword) {
  const db = getDatabase()
  const passwordHash = await bcrypt.hash(newPassword, 10)
  
  await db.prepare(`
    UPDATE customer_accounts 
    SET password_hash = ?, password_changed_at = NOW(), login_attempts = 0, locked_until = NULL, updated_at = NOW()
    WHERE id = ?
  `).run(passwordHash, id)
  
  return true
}

/**
 * 删除客户门户账户
 */
export async function deleteCustomerAccount(id) {
  const db = getDatabase()
  await db.prepare('DELETE FROM customer_accounts WHERE id = ?').run(id)
  return true
}

/**
 * 验证客户登录
 */
export async function verifyCustomerLogin(username, password) {
  const db = getDatabase()
  console.log('🔍 查询账户:', username)
  
  const account = await db.prepare(`
    SELECT ca.*, c.customer_name, c.customer_code
    FROM customer_accounts ca
    LEFT JOIN customers c ON ca.customer_id = c.id::text
    WHERE ca.username = ?
  `).get(username)
  
  console.log('🔍 查询结果:', account ? { id: account.id, username: account.username, hasPasswordHash: !!account.password_hash, status: account.status } : null)
  
  if (!account) {
    return { success: false, error: '账户不存在' }
  }
  
  // 检查账户状态
  if (account.status === 'inactive') {
    return { success: false, error: '账户已禁用，请联系管理员' }
  }
  
  if (account.status === 'locked') {
    if (account.locked_until && new Date(account.locked_until) > new Date()) {
      return { success: false, error: '账户已锁定，请稍后再试' }
    }
    // 锁定时间已过，解除锁定
    await db.prepare(`UPDATE customer_accounts SET status = 'active', login_attempts = 0, locked_until = NULL WHERE id = ?`).run(account.id)
  }
  
  // 验证密码
  const isValid = await bcrypt.compare(password, account.password_hash)
  
  if (!isValid) {
    // 增加失败次数
    const attempts = (account.login_attempts || 0) + 1
    if (attempts >= 5) {
      // 锁定账户30分钟
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString()
      await db.prepare(`UPDATE customer_accounts SET login_attempts = ?, locked_until = ?, status = 'locked' WHERE id = ?`).run(attempts, lockedUntil, account.id)
      return { success: false, error: '密码错误次数过多，账户已锁定30分钟' }
    } else {
      await db.prepare(`UPDATE customer_accounts SET login_attempts = ? WHERE id = ?`).run(attempts, account.id)
      return { success: false, error: `密码错误，还有 ${5 - attempts} 次机会` }
    }
  }
  
  // 登录成功，清除失败计数
  await db.prepare(`
    UPDATE customer_accounts 
    SET login_attempts = 0, locked_until = NULL, last_login_at = NOW()
    WHERE id = ?
  `).run(account.id)
  
  return { 
    success: true, 
    account: convertAccountToCamelCase(account)
  }
}

/**
 * 记录登录IP
 */
export async function updateLoginInfo(accountId, ip) {
  const db = getDatabase()
  await db.prepare(`
    UPDATE customer_accounts SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?
  `).run(ip, accountId)
}

// ==================== API 密钥管理 ====================

/**
 * 生成 API Key
 */
function generateApiKey() {
  const prefix = 'ak_live_'
  const random = crypto.randomBytes(24).toString('hex')
  return prefix + random
}

/**
 * 生成 API Secret
 */
function generateApiSecret() {
  const prefix = 'sk_live_'
  const random = crypto.randomBytes(32).toString('hex')
  return prefix + random
}

/**
 * 生成 Webhook Secret
 */
function generateWebhookSecret() {
  return 'whsec_' + crypto.randomBytes(24).toString('hex')
}

/**
 * 获取客户的 API 密钥列表
 */
export async function getCustomerApiKeys(customerId) {
  const db = getDatabase()
  const rows = await db.prepare(`
    SELECT * FROM customer_api_keys 
    WHERE customer_id = ?
    ORDER BY created_at DESC
  `).all(customerId)
  
  return rows.map(convertApiKeyToCamelCase)
}

/**
 * 根据 API Key 获取密钥信息（用于认证）
 */
export async function getApiKeyByKey(apiKey) {
  const db = getDatabase()
  const row = await db.prepare(`
    SELECT ak.*, c.customer_name, c.customer_code
    FROM customer_api_keys ak
    LEFT JOIN customers c ON ak.customer_id = c.id::text
    WHERE ak.api_key = ?
  `).get(apiKey)
  
  return row ? convertApiKeyToCamelCase(row) : null
}

/**
 * 创建 API 密钥
 */
export async function createApiKey(data) {
  const db = getDatabase()
  const { customerId, keyName, permissions, ipWhitelist, rateLimit, expiresAt, webhookUrl, createdBy } = data
  
  const apiKey = generateApiKey()
  const apiSecret = generateApiSecret()
  const apiSecretHash = await bcrypt.hash(apiSecret, 10)
  const webhookSecret = webhookUrl ? generateWebhookSecret() : null
  
  const result = await db.prepare(`
    INSERT INTO customer_api_keys (
      customer_id, key_name, api_key, api_secret_hash, permissions, 
      ip_whitelist, rate_limit, expires_at, webhook_url, webhook_secret, created_by, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    customerId,
    keyName,
    apiKey,
    apiSecretHash,
    JSON.stringify(permissions || ['order:read']),
    ipWhitelist ? `{${ipWhitelist.join(',')}}` : null,
    rateLimit || 100,
    expiresAt || null,
    webhookUrl || null,
    webhookSecret,
    createdBy || null
  )
  
  // 返回密钥信息（Secret 只在创建时返回一次）
  return {
    id: result.lastInsertRowid,
    apiKey,
    apiSecret,  // 只在创建时返回，之后不可查看
    webhookSecret  // 只在创建时返回
  }
}

/**
 * 更新 API 密钥
 */
export async function updateApiKey(id, data) {
  const db = getDatabase()
  const { keyName, permissions, ipWhitelist, rateLimit, expiresAt, webhookUrl, isActive } = data
  
  const updates = ['updated_at = NOW()']
  const values = []
  
  if (keyName !== undefined) {
    updates.push('key_name = ?')
    values.push(keyName)
  }
  if (permissions !== undefined) {
    updates.push('permissions = ?')
    values.push(JSON.stringify(permissions))
  }
  if (ipWhitelist !== undefined) {
    updates.push('ip_whitelist = ?')
    values.push(ipWhitelist && ipWhitelist.length > 0 ? `{${ipWhitelist.join(',')}}` : null)
  }
  if (rateLimit !== undefined) {
    updates.push('rate_limit = ?')
    values.push(rateLimit)
  }
  if (expiresAt !== undefined) {
    updates.push('expires_at = ?')
    values.push(expiresAt)
  }
  if (webhookUrl !== undefined) {
    updates.push('webhook_url = ?')
    values.push(webhookUrl)
    // 如果设置了新的 webhook_url，生成新的 webhook_secret
    if (webhookUrl) {
      const webhookSecret = generateWebhookSecret()
      updates.push('webhook_secret = ?')
      values.push(webhookSecret)
    }
  }
  if (isActive !== undefined) {
    updates.push('is_active = ?')
    values.push(isActive)
  }
  
  values.push(id)
  
  await db.prepare(`UPDATE customer_api_keys SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  return true
}

/**
 * 删除 API 密钥
 */
export async function deleteApiKey(id) {
  const db = getDatabase()
  await db.prepare('DELETE FROM customer_api_keys WHERE id = ?').run(id)
  return true
}

/**
 * 验证 API 密钥
 */
export async function verifyApiKey(apiKey, apiSecret) {
  const db = getDatabase()
  const keyInfo = await db.prepare(`
    SELECT ak.*, c.customer_name, c.customer_code
    FROM customer_api_keys ak
    LEFT JOIN customers c ON ak.customer_id = c.id::text
    WHERE ak.api_key = ?
  `).get(apiKey)
  
  if (!keyInfo) {
    return { valid: false, error: 'API Key 无效', errorCode: '401001' }
  }
  
  if (!keyInfo.is_active) {
    return { valid: false, error: '密钥已禁用', errorCode: '401003' }
  }
  
  if (keyInfo.expires_at && new Date(keyInfo.expires_at) < new Date()) {
    return { valid: false, error: '密钥已过期', errorCode: '401004' }
  }
  
  // 验证 Secret
  const isSecretValid = await bcrypt.compare(apiSecret, keyInfo.api_secret_hash)
  if (!isSecretValid) {
    return { valid: false, error: 'API Secret 错误', errorCode: '401002' }
  }
  
  return { 
    valid: true, 
    keyInfo: convertApiKeyToCamelCase(keyInfo)
  }
}

/**
 * 更新 API 密钥使用信息
 */
export async function updateApiKeyUsage(apiKeyId, ip) {
  const db = getDatabase()
  await db.prepare(`
    UPDATE customer_api_keys 
    SET last_used_at = NOW(), last_used_ip = ?, usage_count = usage_count + 1 
    WHERE id = ?
  `).run(ip, apiKeyId)
}

/**
 * 记录 API 调用日志
 */
export async function logApiCall(data) {
  const db = getDatabase()
  const { 
    apiKeyId, customerId, apiKey, endpoint, method, 
    requestIp, requestHeaders, requestBody, 
    responseStatus, responseBody, errorMessage, durationMs 
  } = data
  
  await db.prepare(`
    INSERT INTO api_call_logs (
      api_key_id, customer_id, api_key, endpoint, method, 
      request_ip, request_headers, request_body, 
      response_status, response_body, error_message, duration_ms, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `).run(
    apiKeyId || null,
    customerId || null,
    apiKey || null,
    endpoint,
    method,
    requestIp || null,
    requestHeaders ? JSON.stringify(requestHeaders) : null,
    requestBody ? JSON.stringify(requestBody) : null,
    responseStatus || null,
    responseBody ? JSON.stringify(responseBody) : null,
    errorMessage || null,
    durationMs || null
  )
}

/**
 * 获取 API 调用日志
 */
export async function getApiCallLogs(params = {}) {
  const db = getDatabase()
  const { customerId, apiKeyId, endpoint, status, startDate, endDate, page = 1, pageSize = 50 } = params
  
  let sql = `SELECT * FROM api_call_logs WHERE 1=1`
  const conditions = []
  
  if (customerId) {
    sql += ` AND customer_id = ?`
    conditions.push(customerId)
  }
  if (apiKeyId) {
    sql += ` AND api_key_id = ?`
    conditions.push(apiKeyId)
  }
  if (endpoint) {
    sql += ` AND endpoint LIKE ?`
    conditions.push(`%${endpoint}%`)
  }
  if (status) {
    sql += ` AND response_status = ?`
    conditions.push(status)
  }
  if (startDate) {
    sql += ` AND created_at >= ?`
    conditions.push(startDate)
  }
  if (endDate) {
    sql += ` AND created_at <= ?`
    conditions.push(endDate)
  }
  
  // 计数
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total')
  const countResult = await db.prepare(countSql).get(...conditions)
  
  // 分页
  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
  conditions.push(pageSize, (page - 1) * pageSize)
  
  const rows = await db.prepare(sql).all(...conditions)
  
  return {
    list: rows.map(convertApiLogToCamelCase),
    total: countResult?.total || 0,
    page,
    pageSize
  }
}

// ==================== 数据转换函数 ====================

function convertAccountToCamelCase(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerCode: row.customer_code,
    username: row.username,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    status: row.status,
    loginAttempts: row.login_attempts,
    lockedUntil: row.locked_until,
    lastLoginAt: row.last_login_at,
    lastLoginIp: row.last_login_ip,
    passwordChangedAt: row.password_changed_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function convertApiKeyToCamelCase(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerCode: row.customer_code,
    keyName: row.key_name,
    apiKey: row.api_key,
    permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
    ipWhitelist: row.ip_whitelist,
    rateLimit: row.rate_limit,
    isActive: row.is_active,
    lastUsedAt: row.last_used_at,
    lastUsedIp: row.last_used_ip,
    usageCount: row.usage_count,
    expiresAt: row.expires_at,
    webhookUrl: row.webhook_url,
    webhookSecret: row.webhook_secret,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function convertApiLogToCamelCase(row) {
  return {
    id: row.id,
    apiKeyId: row.api_key_id,
    customerId: row.customer_id,
    apiKey: row.api_key,
    endpoint: row.endpoint,
    method: row.method,
    requestIp: row.request_ip,
    requestHeaders: row.request_headers ? JSON.parse(row.request_headers) : null,
    requestBody: row.request_body ? JSON.parse(row.request_body) : null,
    responseStatus: row.response_status,
    responseBody: row.response_body ? JSON.parse(row.response_body) : null,
    errorMessage: row.error_message,
    durationMs: row.duration_ms,
    createdAt: row.created_at
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
  CONTRACT_SIGN_STATUS,
  FEEDBACK_TYPE,
  FEEDBACK_STATUS,
  FEEDBACK_PRIORITY,
  ACCOUNT_STATUS,
  API_PERMISSIONS,
  
  // 客户管理
  getCustomers,
  getCustomerStats,
  getCustomerById,
  getCustomerByCode,
  generateCustomerCode,
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
  getCustomerOrderTrend,
  getCustomerOrders,
  
  // 客户地址
  getCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  
  // 客户税号（旧版：每个税号一条记录）
  getCustomerTaxNumbers,
  createCustomerTaxNumber,
  updateCustomerTaxNumber,
  deleteCustomerTaxNumber,
  
  // 客户公司税号信息（新版：每个公司一条记录）
  getCustomerTaxInfoList,
  createCustomerTaxInfo,
  updateCustomerTaxInfo,
  deleteCustomerTaxInfo,
  
  // 共享税号（公司级税号库）
  getSharedTaxNumbers,
  getSharedTaxNumberById,
  createSharedTaxNumber,
  updateSharedTaxNumber,
  voidSharedTaxNumber,
  restoreSharedTaxNumber,
  
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
  createQuotationForCustomer,

  // 合同管理
  getContracts,
  getContractById,
  createContract,
  updateContract,
  deleteContract,
  // 合同签署管理
  generateContractForOpportunity,
  uploadSignedContract,
  updateContractSignStatus,
  getContractSignHistory,
  getContractByOpportunityId,
  getPendingSignContracts,
  canOpportunityClose,
  updateOpportunityContract,

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
  
  // 客户门户账户管理
  getCustomerAccounts,
  getCustomerAccountById,
  getCustomerAccountByUsername,
  createCustomerAccount,
  updateCustomerAccount,
  resetCustomerAccountPassword,
  deleteCustomerAccount,
  verifyCustomerLogin,
  updateLoginInfo,
  
  // API 密钥管理
  getCustomerApiKeys,
  getApiKeyByKey,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  verifyApiKey,
  updateApiKeyUsage,
  logApiCall,
  getApiCallLogs
}

// ==================== 最后里程费率集成 ====================

/**
 * 获取最后里程费率用于报价单
 * @param {Object} params - 查询参数
 * @param {number} params.carrierId - 承运商ID
 * @param {string} params.zoneCode - Zone编码
 * @param {number} params.weight - 重量
 * @returns {Object} 费率信息
 */
export async function getLastMileRateForQuotation(params) {
  const db = getDatabase()
  const { carrierId, zoneCode, weight } = params
  
  // 获取当前有效的费率卡
  const today = new Date().toISOString().split('T')[0]
  const rateCard = await db.prepare(`
    SELECT r.*, c.carrier_name, c.carrier_code 
    FROM unified_rate_cards r
    LEFT JOIN last_mile_carriers c ON r.carrier_id = c.id
    WHERE r.carrier_id = ? 
    AND r.status = 'active'
    AND r.valid_from <= ?
    AND (r.valid_until IS NULL OR r.valid_until >= ?)
    ORDER BY r.is_default DESC, r.created_at DESC
    LIMIT 1
  `).get(carrierId, today, today)
  
  if (!rateCard) {
    return null
  }
  
  // 查找匹配的费率
  const tier = await db.prepare(`
    SELECT * FROM rate_card_tiers
    WHERE rate_card_id = ?
    AND zone_code = ?
    AND weight_from <= ?
    AND weight_to >= ?
    ORDER BY weight_from
    LIMIT 1
  `).get(rateCard.id, zoneCode, weight, weight)
  
  if (!tier) {
    return null
  }
  
  return {
    carrierId: rateCard.carrier_id,
    carrierCode: rateCard.carrier_code,
    carrierName: rateCard.carrier_name,
    rateCardId: rateCard.id,
    rateCardName: rateCard.rate_card_name,
    currency: rateCard.currency,
    zoneCode: tier.zone_code,
    weightRange: `${tier.weight_from}-${tier.weight_to}`,
    purchasePrice: tier.purchase_price ? parseFloat(tier.purchase_price) : null,
    salesPrice: tier.sales_price ? parseFloat(tier.sales_price) : null,
    priceUnit: tier.price_unit
  }
}

// ==================== 共享税号供应商关联修复 ====================

/**
 * 同步共享税号与供应商关联
 * 将共享税号关联到已存在的供应商
 */
export async function syncSharedTaxSuppliers() {
  const db = getDatabase()
  const results = []
  
  // 定义映射关系：公司简称 -> 供应商编码
  const supplierMappings = {
    'DBWIH': 'IA-DBWIH',
    'kurz DBWIH': 'IA-DBWIH',
    'DWGK': 'IA-DWGK',
    'Feldsberg': 'IA-FELDSBERG',
    'Feld': 'IA-FELDSBERG',
    'KIWI': 'IA-KIWISTAV',
    'Kiwistav': 'IA-KIWISTAV',
    'KIWISTAV': 'IA-KIWISTAV',
    'Kralovec AI': 'IA-KRALOVECAI',
  }
  
  // 获取所有共享税号
  const taxNumbers = await db.prepare(`
    SELECT id, company_short_name, company_name, tax_number, supplier_id, supplier_code
    FROM shared_tax_numbers
  `).all()
  
  for (const tax of taxNumbers) {
    const shortName = tax.company_short_name || tax.company_name
    
    // 查找匹配的供应商编码
    let targetSupplierCode = supplierMappings[shortName]
    
    if (!targetSupplierCode) {
      // 模糊匹配
      for (const [key, code] of Object.entries(supplierMappings)) {
        if (shortName?.toLowerCase().includes(key.toLowerCase()) || 
            key.toLowerCase().includes(shortName?.toLowerCase() || '')) {
          targetSupplierCode = code
          break
        }
      }
    }
    
    if (!targetSupplierCode) {
      // 根据简称生成
      targetSupplierCode = `IA-${shortName?.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'UNKNOWN'}`
    }
    
    // 查找供应商
    const supplier = await db.prepare(`
      SELECT id, supplier_code, supplier_name FROM suppliers WHERE supplier_code = ?
    `).get(targetSupplierCode)
    
    if (supplier) {
      // 更新共享税号关联
      await db.prepare(`
        UPDATE shared_tax_numbers 
        SET supplier_id = ?, supplier_code = ?, updated_at = NOW()
        WHERE id = ?
      `).run(supplier.id, supplier.supplier_code, tax.id)
      
      results.push({
        taxNumber: tax.tax_number,
        companyShortName: shortName,
        supplierCode: supplier.supplier_code,
        supplierName: supplier.supplier_name,
        status: 'linked'
      })
    } else {
      results.push({
        taxNumber: tax.tax_number,
        companyShortName: shortName,
        supplierCode: targetSupplierCode,
        supplierName: null,
        status: 'not_found'
      })
    }
  }
  
  return results
}
