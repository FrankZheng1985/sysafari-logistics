/**
 * 客户询价模块 - 数据模型
 * 包含：询价管理、卡车类型、报价计算、工作流分配
 */

import { getDatabase, generateId } from '../../config/database.js'
import * as messageModel from '../message/model.js'

// ==================== 常量定义 ====================

export const INQUIRY_TYPE = {
  CLEARANCE: 'clearance',     // 清关询价
  TRANSPORT: 'transport',     // 运输询价
  COMBINED: 'combined'        // 综合询价（清关+运输）
}

export const INQUIRY_STATUS = {
  PENDING: 'pending',         // 待报价
  PROCESSING: 'processing',   // 处理中
  QUOTED: 'quoted',           // 已报价
  ACCEPTED: 'accepted',       // 已接受
  REJECTED: 'rejected',       // 已拒绝
  EXPIRED: 'expired',         // 已过期
  CONVERTED: 'converted'      // 已转订单
}

export const INQUIRY_PRIORITY = {
  URGENT: 'urgent',           // 紧急
  HIGH: 'high',               // 高
  NORMAL: 'normal',           // 普通
  LOW: 'low'                  // 低
}

export const TASK_STATUS = {
  PENDING: 'pending',         // 待处理
  PROCESSING: 'processing',   // 处理中
  COMPLETED: 'completed',     // 已完成
  OVERDUE: 'overdue'          // 已超时
}

export const TRUCK_CATEGORY = {
  VAN: 'van',                 // 厢式车
  BOX: 'box',                 // 箱式货车
  SEMI: 'semi',               // 半挂车
  REEFER: 'reefer',           // 冷藏车
  FLATBED: 'flatbed',         // 平板车
  HAZMAT: 'hazmat'            // 危险品车
}

// 默认处理时限（小时）
const DEFAULT_DUE_HOURS = 24

// ==================== 询价编号生成 ====================

/**
 * 生成询价编号
 * 格式: INQ + 年份 + 6位序号，如 INQ20250001
 */
export async function generateInquiryNumber() {
  const db = getDatabase()
  const year = new Date().getFullYear()
  
  // 先尝试更新序号
  let result = await db.prepare(`
    UPDATE order_sequences 
    SET current_seq = current_seq + 1, updated_at = CURRENT_TIMESTAMP
    WHERE business_type = 'inquiry'
    RETURNING current_seq
  `).get()
  
  // 如果序列不存在，先创建再获取
  if (!result?.current_seq) {
    // 插入初始序列（如果不存在）
    await db.prepare(`
      INSERT INTO order_sequences (business_type, current_seq, prefix, description)
      VALUES ('inquiry', 1, 'INQ', '客户询价编号')
      ON CONFLICT (business_type) DO UPDATE SET current_seq = order_sequences.current_seq + 1
      RETURNING current_seq
    `).run()
    
    // 重新获取序列号
    result = await db.prepare(`
      SELECT current_seq FROM order_sequences WHERE business_type = 'inquiry'
    `).get()
  }
  
  const seq = result?.current_seq || 1
  return `INQ${year}${String(seq).padStart(6, '0')}`
}

// ==================== 用户和分配相关 ====================

/**
 * 获取客户的负责跟单员
 * 从 customers 表的 assigned_to 字段获取，否则返回 null
 */
export async function getCustomerAssignee(customerId) {
  const db = getDatabase()
  
  // 从客户表查找负责的跟单员/业务员
  // 注意：客户表使用 assigned_to 和 assigned_name 字段存储负责人
  // assigned_to 是 varchar 类型，需要转换为 integer 与 users.id 比较
  const customer = await db.prepare(`
    SELECT c.assigned_to, c.assigned_name, u.supervisor_id, s.name as supervisor_name,
           ss.supervisor_id as super_supervisor_id, ss2.name as super_supervisor_name
    FROM customers c
    LEFT JOIN users u ON c.assigned_to::integer = u.id
    LEFT JOIN users s ON u.supervisor_id = s.id
    LEFT JOIN users ss ON s.supervisor_id = ss.id
    LEFT JOIN users ss2 ON ss.supervisor_id = ss2.id
    WHERE c.id = $1
  `).get(customerId)
  
  if (!customer || !customer.assigned_to) {
    console.log(`[询价分配] 客户 ${customerId} 没有设置负责业务员`)
    return null
  }
  
  console.log(`[询价分配] 客户 ${customerId} 的负责人: ${customer.assigned_name} (ID: ${customer.assigned_to})`)
  
  return {
    assigneeId: customer.assigned_to,
    assigneeName: customer.assigned_name,
    supervisorId: customer.supervisor_id || null,
    supervisorName: customer.supervisor_name || null,
    superSupervisorId: customer.super_supervisor_id || null,
    superSupervisorName: customer.super_supervisor_name || null
  }
}

/**
 * 获取用户的上级链
 */
export async function getUserSupervisorChain(userId) {
  const db = getDatabase()
  
  const user = await db.prepare(`
    SELECT u.id, u.name, u.role, u.supervisor_id,
           s.id as sup_id, s.name as sup_name, s.supervisor_id as sup_supervisor_id,
           ss.id as sup_sup_id, ss.name as sup_sup_name
    FROM users u
    LEFT JOIN users s ON u.supervisor_id = s.id
    LEFT JOIN users ss ON s.supervisor_id = ss.id
    WHERE u.id = $1
  `).get(userId)
  
  if (!user) return null
  
  return {
    user: { id: user.id, name: user.name, role: user.role },
    supervisor: user.sup_id ? { id: user.sup_id, name: user.sup_name } : null,
    superSupervisor: user.sup_sup_id ? { id: user.sup_sup_id, name: user.sup_sup_name } : null
  }
}

// ==================== 询价管理 ====================

/**
 * 创建询价（包含自动分配和待办任务）
 */
export async function createInquiry(data) {
  const db = getDatabase()
  const id = generateId()
  const inquiryNumber = await generateInquiryNumber()
  
  // 计算有效期（默认7天）
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 7)
  
  // 计算处理截止时间
  const dueAt = new Date()
  dueAt.setHours(dueAt.getHours() + (data.priority === 'urgent' ? 4 : DEFAULT_DUE_HOURS))
  
  // 获取客户的负责跟单员
  const assignee = await getCustomerAssignee(data.customerId)
  
  // 创建询价记录
  await db.prepare(`
    INSERT INTO customer_inquiries (
      id, inquiry_number, customer_id, customer_name, inquiry_type, status,
      clearance_data, transport_data, attachments, notes, valid_until,
      assigned_to, assigned_to_name, assigned_at, due_at, priority, source
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
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
    validUntil.toISOString().split('T')[0],
    assignee?.assigneeId || null,
    assignee?.assigneeName || null,
    assignee ? new Date().toISOString() : null,
    dueAt.toISOString(),
    data.priority || INQUIRY_PRIORITY.NORMAL,
    data.source || 'portal'
  )
  
  // 如果有分配的跟单员，创建待办任务
  if (assignee) {
    await createInquiryTask({
      inquiryId: id,
      inquiryNumber,
      assigneeId: assignee.assigneeId,
      assigneeName: assignee.assigneeName,
      supervisorId: assignee.supervisorId,
      supervisorName: assignee.supervisorName,
      superSupervisorId: assignee.superSupervisorId,
      superSupervisorName: assignee.superSupervisorName,
      dueAt
    })
  }
  
  return { id, inquiryNumber, assignee }
}

/**
 * 创建询价待办任务
 */
export async function createInquiryTask(data) {
  const db = getDatabase()
  
  // 为跟单员创建处理任务
  await db.prepare(`
    INSERT INTO inquiry_tasks (
      inquiry_id, inquiry_number, assignee_id, assignee_name, assignee_role,
      supervisor_id, supervisor_name, super_supervisor_id, super_supervisor_name,
      task_type, status, due_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `).run(
    data.inquiryId,
    data.inquiryNumber,
    data.assigneeId,
    data.assigneeName,
    'operator',
    data.supervisorId || null,
    data.supervisorName || null,
    data.superSupervisorId || null,
    data.superSupervisorName || null,
    'process',
    TASK_STATUS.PENDING,
    data.dueAt.toISOString()
  )
  
  // 发送消息通知给指定的业务员
  try {
    await messageModel.createMessage({
      type: 'inquiry',
      title: '新询价任务',
      content: `您有一个新的客户询价需要处理，询价编号：${data.inquiryNumber}`,
      senderId: null,
      senderName: '系统',
      receiverId: data.assigneeId,
      receiverName: data.assigneeName,
      relatedType: 'inquiry',
      relatedId: data.inquiryId
    })
    
    // 如果有上级主管，也发送通知
    if (data.supervisorId) {
      await messageModel.createMessage({
        type: 'inquiry',
        title: '团队新询价',
        content: `${data.assigneeName} 收到一个新的客户询价任务，询价编号：${data.inquiryNumber}`,
        senderId: null,
        senderName: '系统',
        receiverId: data.supervisorId,
        receiverName: data.supervisorName,
        relatedType: 'inquiry',
        relatedId: data.inquiryId
      })
    }
  } catch (error) {
    console.error('发送询价通知失败:', error)
    // 通知发送失败不影响主流程
  }
  
  return true
}

/**
 * 手动分配询价给跟单员
 */
export async function assignInquiry(inquiryId, assigneeId, assignedBy) {
  const db = getDatabase()
  
  // 获取被分配用户的上级链
  const chain = await getUserSupervisorChain(assigneeId)
  if (!chain) {
    throw new Error('找不到指定的用户')
  }
  
  // 计算截止时间
  const dueAt = new Date()
  dueAt.setHours(dueAt.getHours() + DEFAULT_DUE_HOURS)
  
  // 更新询价的分配信息
  await db.prepare(`
    UPDATE customer_inquiries
    SET assigned_to = $1, assigned_to_name = $2, assigned_at = CURRENT_TIMESTAMP,
        due_at = $3, updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
  `).run(assigneeId, chain.user.name, dueAt.toISOString(), inquiryId)
  
  // 获取询价编号
  const inquiry = await getInquiryById(inquiryId)
  
  // 创建待办任务
  await createInquiryTask({
    inquiryId,
    inquiryNumber: inquiry.inquiryNumber,
    assigneeId: chain.user.id,
    assigneeName: chain.user.name,
    supervisorId: chain.supervisor?.id || null,
    supervisorName: chain.supervisor?.name || null,
    superSupervisorId: chain.superSupervisor?.id || null,
    superSupervisorName: chain.superSupervisor?.name || null,
    dueAt
  })
  
  return { success: true, assignee: chain }
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
    // 'unquoted' 表示待报价（pending 或 processing）
    if (status === 'unquoted') {
      query += ` AND status IN ('pending', 'processing')`
    } else {
    query += ` AND status = $${paramIndex++}`
    queryParams.push(status)
    }
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
      processed_at = CURRENT_TIMESTAMP,
      crm_quote_id = $11,
      transport_price_id = $12,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $13
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
    quoteData.crmQuoteId || null,
    quoteData.transportPriceId || null,
    id
  )
  
  // 完成对应的待办任务
  await completeInquiryTask(id, quoteData.quotedBy)
  
  return true
}

// ==================== 待办任务管理 ====================

/**
 * 获取待处理询价任务列表
 */
export async function getPendingInquiryTasks(params = {}) {
  const db = getDatabase()
  const { userId, role, status, page = 1, pageSize = 20 } = params
  
  let query = `
    SELECT t.*, i.customer_name, i.inquiry_type, i.status as inquiry_status,
           i.transport_data, i.clearance_data, i.priority, i.source
    FROM inquiry_tasks t
    JOIN customer_inquiries i ON t.inquiry_id = i.id
    WHERE 1=1
  `
  const queryParams = []
  let paramIndex = 1
  
  // 根据角色筛选
  if (userId) {
    // 跟单员看自己的，上级看下属的
    query += ` AND (t.assignee_id = $${paramIndex} OR t.supervisor_id = $${paramIndex} OR t.super_supervisor_id = $${paramIndex})`
    queryParams.push(userId)
    paramIndex++
  }
  
  if (status) {
    query += ` AND t.status = $${paramIndex++}`
    queryParams.push(status)
  } else {
    // 默认只查待处理的
    query += ` AND t.status IN ('pending', 'processing')`
  }
  
  // 计数
  const countQuery = query.replace(/SELECT t\.\*, i\.[^F]+FROM/, 'SELECT COUNT(*) as total FROM')
  const countResult = await db.prepare(countQuery).get(...queryParams)
  
  // 排序和分页
  query += ` ORDER BY 
    CASE WHEN i.priority = 'urgent' THEN 1 
         WHEN i.priority = 'high' THEN 2 
         WHEN i.priority = 'normal' THEN 3 
         ELSE 4 END,
    t.due_at ASC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertTaskToCamelCase),
    total: countResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 获取询价的待办任务
 */
export async function getInquiryTask(inquiryId) {
  const db = getDatabase()
  const task = await db.prepare(`
    SELECT * FROM inquiry_tasks WHERE inquiry_id = $1 ORDER BY created_at DESC LIMIT 1
  `).get(inquiryId)
  return task ? convertTaskToCamelCase(task) : null
}

/**
 * 更新任务状态为处理中
 */
export async function startInquiryTask(inquiryId, userId) {
  const db = getDatabase()
  
  await db.prepare(`
    UPDATE inquiry_tasks 
    SET status = 'processing', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE inquiry_id = $1 AND assignee_id = $2 AND status = 'pending'
  `).run(inquiryId, userId)
  
  // 同时更新询价状态
  await db.prepare(`
    UPDATE customer_inquiries
    SET status = 'processing', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND status = 'pending'
  `).run(inquiryId)
  
  return true
}

/**
 * 完成询价待办任务
 */
export async function completeInquiryTask(inquiryId, userId) {
  const db = getDatabase()
  
  await db.prepare(`
    UPDATE inquiry_tasks 
    SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE inquiry_id = $1
  `).run(inquiryId)
  
  return true
}

/**
 * 检查并标记超时任务
 */
export async function checkOverdueTasks() {
  const db = getDatabase()
  
  // 更新超时的任务
  const result = await db.prepare(`
    UPDATE inquiry_tasks 
    SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
    WHERE status IN ('pending', 'processing') 
      AND due_at < CURRENT_TIMESTAMP
    RETURNING id, inquiry_id, assignee_id, supervisor_id, super_supervisor_id
  `).all()
  
  // 同时更新询价的超时标记
  if (result.length > 0) {
    const inquiryIds = result.map(r => r.inquiry_id)
    for (const inquiryId of inquiryIds) {
      await db.prepare(`
        UPDATE customer_inquiries
        SET is_overdue = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `).run(inquiryId)
    }
  }
  
  return result
}

/**
 * 获取待办任务统计
 * @param {number} userId - 用户ID
 * @param {string} userRole - 用户角色（admin可以看到所有）
 */
export async function getTaskStats(userId, userRole = '') {
  const db = getDatabase()
  
  // 管理员或高级角色可以看到所有询价统计
  const isAdmin = ['admin', 'super_admin', 'manager'].includes(userRole)
  
  if (isAdmin) {
    // 管理员：从 customer_inquiries 表直接统计所有询价
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
        COUNT(*) FILTER (WHERE is_overdue = TRUE AND status NOT IN ('completed', 'cancelled', 'quoted')) as overdue_count,
        COUNT(*) FILTER (WHERE status IN ('completed', 'quoted') AND DATE(updated_at) = CURRENT_DATE) as today_completed
      FROM customer_inquiries
    `).get()
    
    return {
      pendingCount: parseInt(stats?.pending_count) || 0,
      processingCount: parseInt(stats?.processing_count) || 0,
      overdueCount: parseInt(stats?.overdue_count) || 0,
      todayCompleted: parseInt(stats?.today_completed) || 0
    }
  }
  
  // 普通用户：统计分配给自己的任务
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) FILTER (WHERE t.status = 'pending') as pending_count,
      COUNT(*) FILTER (WHERE t.status = 'processing') as processing_count,
      COUNT(*) FILTER (WHERE t.status = 'overdue') as overdue_count,
      COUNT(*) FILTER (WHERE t.status = 'completed' AND DATE(t.completed_at) = CURRENT_DATE) as today_completed
    FROM inquiry_tasks t
    WHERE t.assignee_id = $1 OR t.supervisor_id = $1 OR t.super_supervisor_id = $1
  `).get(userId)
  
  return {
    pendingCount: parseInt(stats?.pending_count) || 0,
    processingCount: parseInt(stats?.processing_count) || 0,
    overdueCount: parseInt(stats?.overdue_count) || 0,
    todayCompleted: parseInt(stats?.today_completed) || 0
  }
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
    
    // 分配信息
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name,
    assignedAt: row.assigned_at,
    dueAt: row.due_at,
    processedAt: row.processed_at,
    isOverdue: row.is_overdue,
    priority: row.priority || 'normal',
    source: row.source || 'portal',
    
    // 关联
    crmOpportunityId: row.crm_opportunity_id,
    crmQuoteId: row.crm_quote_id,
    transportPriceId: row.transport_price_id,
    billId: row.bill_id,
    
    attachments,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    
    // 作废相关字段
    isVoid: row.is_void || false,
    voidReason: row.void_reason,
    voidTime: row.void_time,
    voidBy: row.void_by,
    voidByName: row.void_by_name
  }
}

function convertTaskToCamelCase(row) {
  // 解析可能的 JSON 字段
  let transportData = null
  let clearanceData = null
  
  try {
    if (row.transport_data) {
      transportData = typeof row.transport_data === 'string' 
        ? JSON.parse(row.transport_data) 
        : row.transport_data
    }
    if (row.clearance_data) {
      clearanceData = typeof row.clearance_data === 'string' 
        ? JSON.parse(row.clearance_data) 
        : row.clearance_data
    }
  } catch (e) {
    // 解析失败保持原值
  }
  
  return {
    id: row.id,
    inquiryId: row.inquiry_id,
    inquiryNumber: row.inquiry_number,
    
    // 分配信息
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    assigneeRole: row.assignee_role,
    supervisorId: row.supervisor_id,
    supervisorName: row.supervisor_name,
    superSupervisorId: row.super_supervisor_id,
    superSupervisorName: row.super_supervisor_name,
    
    // 任务状态
    taskType: row.task_type,
    status: row.status,
    
    // 时间
    dueAt: row.due_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    
    // 提醒
    reminderSent: row.reminder_sent,
    overdueNotified: row.overdue_notified,
    
    // 询价信息（JOIN查询时）
    customerName: row.customer_name,
    inquiryType: row.inquiry_type,
    inquiryStatus: row.inquiry_status,
    transportData,
    clearanceData,
    priority: row.priority,
    source: row.source
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

/**
 * 作废询价
 */
export async function voidInquiry(id, reason, voidBy, voidByName) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const result = await db.prepare(`
    UPDATE customer_inquiries 
    SET is_void = TRUE,
        void_reason = ?,
        void_time = ?,
        void_by = ?,
        void_by_name = ?
    WHERE id = ?
  `).run(reason, now, voidBy, voidByName, id)
  
  return result.changes > 0
}

/**
 * 恢复已作废的询价
 */
export async function restoreInquiry(id) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    UPDATE customer_inquiries 
    SET is_void = FALSE,
        void_reason = NULL,
        void_time = NULL,
        void_by = NULL,
        void_by_name = NULL
    WHERE id = ?
  `).run(id)
  
  return result.changes > 0
}

export default {
  // 常量
  INQUIRY_TYPE,
  INQUIRY_STATUS,
  INQUIRY_PRIORITY,
  TASK_STATUS,
  TRUCK_CATEGORY,
  
  // 用户和分配
  getCustomerAssignee,
  getUserSupervisorChain,
  
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
  assignInquiry,
  voidInquiry,
  restoreInquiry,
  
  // 待办任务
  createInquiryTask,
  getPendingInquiryTasks,
  getInquiryTask,
  startInquiryTask,
  completeInquiryTask,
  checkOverdueTasks,
  getTaskStats,
  
  // 卡车类型
  getTruckTypes,
  getTruckTypeById,
  getTruckTypeByCode,
  recommendTruckType
}

