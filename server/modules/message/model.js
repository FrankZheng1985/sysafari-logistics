/**
 * 消息模块 - 数据模型
 */

import { getDatabase } from '../../db-adapter.js'
import { v4 as uuidv4 } from 'uuid'

// ==================== 消息相关 ====================

/**
 * 获取消息列表
 */
export async function getMessages(params = {}) {
  const db = getDatabase()
  const { receiverId, type, isRead, page = 1, pageSize = 20 } = params
  
  let whereConditions = ['1=1']
  const queryParams = []
  let paramIndex = 1
  
  if (receiverId) {
    whereConditions.push(`receiver_id = $${paramIndex++}`)
    queryParams.push(receiverId)
  }
  
  if (type && type !== 'all') {
    whereConditions.push(`type = $${paramIndex++}`)
    queryParams.push(type)
  }
  
  if (isRead !== undefined && isRead !== '') {
    whereConditions.push(`is_read = $${paramIndex++}`)
    queryParams.push(isRead === 'true' || isRead === true ? 1 : 0)
  }
  
  const whereClause = whereConditions.join(' AND ')
  
  // 获取总数
  const countResult = await db.prepare(`
    SELECT COUNT(*) as total FROM messages WHERE ${whereClause}
  `).get(...queryParams)
  
  // 获取分页数据
  const offset = (page - 1) * pageSize
  const list = await db.prepare(`
    SELECT * FROM messages 
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `).all(...queryParams, pageSize, offset)
  
  return {
    list,
    total: parseInt(countResult.total),
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  }
}

/**
 * 获取未读消息数量
 */
export async function getUnreadCount(receiverId) {
  const db = getDatabase()
  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM messages 
    WHERE receiver_id = $1 AND is_read = 0
  `).get(receiverId)
  return parseInt(result.count)
}

/**
 * 获取最近消息（用于通知铃铛下拉）
 */
export async function getRecentMessages(receiverId, limit = 5) {
  const db = getDatabase()
  return await db.prepare(`
    SELECT * FROM messages 
    WHERE receiver_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `).all(receiverId, limit)
}

/**
 * 创建消息
 */
export async function createMessage(data) {
  const db = getDatabase()
  const id = data.id || `msg-${uuidv4()}`
  
  await db.prepare(`
    INSERT INTO messages (id, type, title, content, sender_id, sender_name, receiver_id, receiver_name, related_type, related_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `).run(
    id,
    data.type || 'system',
    data.title,
    data.content || '',
    data.senderId || null,
    data.senderName || null,
    data.receiverId,
    data.receiverName || null,
    data.relatedType || null,
    data.relatedId || null
  )
  
  return { id }
}

/**
 * 批量创建消息（发送给多个接收人）
 */
export async function createMessages(messages) {
  const db = getDatabase()
  const ids = []
  
  for (const msg of messages) {
    const id = msg.id || `msg-${uuidv4()}`
    await db.prepare(`
      INSERT INTO messages (id, type, title, content, sender_id, sender_name, receiver_id, receiver_name, related_type, related_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `).run(
      id,
      msg.type || 'system',
      msg.title,
      msg.content || '',
      msg.senderId || null,
      msg.senderName || null,
      msg.receiverId,
      msg.receiverName || null,
      msg.relatedType || null,
      msg.relatedId || null
    )
    ids.push(id)
  }
  
  return { ids, count: ids.length }
}

/**
 * 标记消息为已读
 */
export async function markAsRead(id) {
  const db = getDatabase()
  await db.prepare(`
    UPDATE messages SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = $1
  `).run(id)
  return { success: true }
}

/**
 * 标记多条消息为已读
 */
export async function markMultipleAsRead(ids) {
  const db = getDatabase()
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')
  await db.prepare(`
    UPDATE messages SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})
  `).run(...ids)
  return { success: true, count: ids.length }
}

/**
 * 标记所有消息为已读
 */
export async function markAllAsRead(receiverId) {
  const db = getDatabase()
  const result = await db.prepare(`
    UPDATE messages SET is_read = 1, read_at = CURRENT_TIMESTAMP 
    WHERE receiver_id = $1 AND is_read = 0
  `).run(receiverId)
  return { success: true, count: result.changes || 0 }
}

/**
 * 删除消息
 */
export async function deleteMessage(id) {
  const db = getDatabase()
  await db.prepare(`DELETE FROM messages WHERE id = $1`).run(id)
  return { success: true }
}

/**
 * 获取消息详情
 */
export async function getMessageById(id) {
  const db = getDatabase()
  return await db.prepare(`SELECT * FROM messages WHERE id = $1`).get(id)
}

// ==================== 审批相关 ====================

/**
 * 获取审批列表
 */
export async function getApprovals(params = {}) {
  const db = getDatabase()
  const { applicantId, approverId, status, approvalType, page = 1, pageSize = 20 } = params
  
  let whereConditions = ['1=1']
  const queryParams = []
  let paramIndex = 1
  
  if (applicantId) {
    whereConditions.push(`applicant_id = $${paramIndex++}`)
    queryParams.push(applicantId)
  }
  
  if (approverId) {
    whereConditions.push(`approver_id = $${paramIndex++}`)
    queryParams.push(approverId)
  }
  
  if (status && status !== 'all') {
    whereConditions.push(`status = $${paramIndex++}`)
    queryParams.push(status)
  }
  
  if (approvalType && approvalType !== 'all') {
    whereConditions.push(`approval_type = $${paramIndex++}`)
    queryParams.push(approvalType)
  }
  
  const whereClause = whereConditions.join(' AND ')
  
  const countResult = await db.prepare(`
    SELECT COUNT(*) as total FROM approvals WHERE ${whereClause}
  `).get(...queryParams)
  
  const offset = (page - 1) * pageSize
  const list = await db.prepare(`
    SELECT * FROM approvals 
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `).all(...queryParams, pageSize, offset)
  
  return {
    list,
    total: parseInt(countResult.total),
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  }
}

/**
 * 获取待审批数量
 */
export async function getPendingApprovalCount(approverId) {
  const db = getDatabase()
  let sql = `SELECT COUNT(*) as count FROM approvals WHERE status = 'pending'`
  const params = []
  
  if (approverId) {
    sql += ` AND (approver_id = $1 OR approver_id IS NULL)`
    params.push(approverId)
  }
  
  const result = await db.prepare(sql).get(...params)
  return parseInt(result.count)
}

/**
 * 创建审批
 */
export async function createApproval(data) {
  const db = getDatabase()
  const id = data.id || `appr-${uuidv4()}`
  
  await db.prepare(`
    INSERT INTO approvals (id, approval_type, business_id, title, content, amount, applicant_id, applicant_name, approver_id, approver_name, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
  `).run(
    id,
    data.approvalType,
    data.businessId || null,
    data.title,
    data.content || '',
    data.amount || null,
    data.applicantId,
    data.applicantName || null,
    data.approverId || null,
    data.approverName || null
  )
  
  return { id }
}

/**
 * 处理审批（通过/驳回）
 */
export async function processApproval(id, data) {
  const db = getDatabase()
  
  await db.prepare(`
    UPDATE approvals 
    SET status = $1, remark = $2, reject_reason = $3, approver_id = $4, approver_name = $5, processed_at = CURRENT_TIMESTAMP
    WHERE id = $6
  `).run(
    data.status,
    data.remark || null,
    data.rejectReason || null,
    data.approverId,
    data.approverName || null,
    id
  )
  
  return { success: true }
}

/**
 * 获取审批详情
 */
export async function getApprovalById(id) {
  const db = getDatabase()
  return await db.prepare(`SELECT * FROM approvals WHERE id = $1`).get(id)
}

/**
 * 根据业务ID获取审批
 */
export async function getApprovalByBusinessId(businessId) {
  const db = getDatabase()
  return await db.prepare(`
    SELECT * FROM approvals WHERE business_id = $1 ORDER BY created_at DESC LIMIT 1
  `).get(businessId)
}

// ==================== 预警相关 ====================

/**
 * 获取预警规则列表
 */
export async function getAlertRules(params = {}) {
  const db = getDatabase()
  const { isActive, ruleType } = params
  
  let whereConditions = ['1=1']
  const queryParams = []
  let paramIndex = 1
  
  if (isActive !== undefined) {
    whereConditions.push(`is_active = $${paramIndex++}`)
    queryParams.push(isActive ? 1 : 0)
  }
  
  if (ruleType) {
    whereConditions.push(`rule_type = $${paramIndex++}`)
    queryParams.push(ruleType)
  }
  
  const whereClause = whereConditions.join(' AND ')
  
  return await db.prepare(`
    SELECT * FROM alert_rules WHERE ${whereClause} ORDER BY created_at ASC
  `).all(...queryParams)
}

/**
 * 获取预警规则详情
 */
export async function getAlertRuleById(id) {
  const db = getDatabase()
  return await db.prepare(`SELECT * FROM alert_rules WHERE id = $1`).get(id)
}

/**
 * 更新预警规则
 */
export async function updateAlertRule(id, data) {
  const db = getDatabase()
  
  const fields = []
  const values = []
  let paramIndex = 1
  
  if (data.ruleName !== undefined) {
    fields.push(`rule_name = $${paramIndex++}`)
    values.push(data.ruleName)
  }
  if (data.conditions !== undefined) {
    fields.push(`conditions = $${paramIndex++}`)
    values.push(JSON.stringify(data.conditions))
  }
  if (data.alertLevel !== undefined) {
    fields.push(`alert_level = $${paramIndex++}`)
    values.push(data.alertLevel)
  }
  if (data.receivers !== undefined) {
    fields.push(`receivers = $${paramIndex++}`)
    values.push(data.receivers)
  }
  if (data.isActive !== undefined) {
    fields.push(`is_active = $${paramIndex++}`)
    values.push(data.isActive ? 1 : 0)
  }
  if (data.description !== undefined) {
    fields.push(`description = $${paramIndex++}`)
    values.push(data.description)
  }
  
  fields.push(`updated_at = CURRENT_TIMESTAMP`)
  
  if (fields.length > 1) {
    values.push(id)
    await db.prepare(`
      UPDATE alert_rules SET ${fields.join(', ')} WHERE id = $${paramIndex}
    `).run(...values)
  }
  
  return { success: true }
}

/**
 * 获取预警日志列表
 */
export async function getAlertLogs(params = {}) {
  const db = getDatabase()
  const { alertType, alertLevel, status, page = 1, pageSize = 20 } = params
  
  let whereConditions = ['1=1']
  const queryParams = []
  let paramIndex = 1
  
  if (alertType && alertType !== 'all') {
    whereConditions.push(`alert_type = $${paramIndex++}`)
    queryParams.push(alertType)
  }
  
  if (alertLevel && alertLevel !== 'all') {
    whereConditions.push(`alert_level = $${paramIndex++}`)
    queryParams.push(alertLevel)
  }
  
  if (status && status !== 'all') {
    whereConditions.push(`status = $${paramIndex++}`)
    queryParams.push(status)
  }
  
  const whereClause = whereConditions.join(' AND ')
  
  const countResult = await db.prepare(`
    SELECT COUNT(*) as total FROM alert_logs WHERE ${whereClause}
  `).get(...queryParams)
  
  const offset = (page - 1) * pageSize
  const list = await db.prepare(`
    SELECT * FROM alert_logs 
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `).all(...queryParams, pageSize, offset)
  
  return {
    list,
    total: parseInt(countResult.total),
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  }
}

/**
 * 获取活跃预警数量
 */
export async function getActiveAlertCount() {
  const db = getDatabase()
  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM alert_logs WHERE status = 'active'
  `).get()
  return parseInt(result.count)
}

/**
 * 创建预警日志
 */
export async function createAlertLog(data) {
  const db = getDatabase()
  
  await db.prepare(`
    INSERT INTO alert_logs (rule_id, rule_name, alert_type, alert_level, title, content, related_type, related_id, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
  `).run(
    data.ruleId || null,
    data.ruleName || null,
    data.alertType,
    data.alertLevel || 'warning',
    data.title,
    data.content || '',
    data.relatedType || null,
    data.relatedId || null
  )
  
  return { success: true }
}

/**
 * 处理预警（标记为已处理）
 */
export async function handleAlert(id, data) {
  const db = getDatabase()
  
  await db.prepare(`
    UPDATE alert_logs 
    SET status = 'handled', handled_by = $1, handled_at = CURRENT_TIMESTAMP, handle_remark = $2
    WHERE id = $3
  `).run(data.handledBy, data.handleRemark || null, id)
  
  return { success: true }
}

/**
 * 忽略预警
 */
export async function ignoreAlert(id, data) {
  const db = getDatabase()
  
  await db.prepare(`
    UPDATE alert_logs 
    SET status = 'ignored', handled_by = $1, handled_at = CURRENT_TIMESTAMP, handle_remark = $2
    WHERE id = $3
  `).run(data.handledBy, data.handleRemark || null, id)
  
  return { success: true }
}

/**
 * 获取预警统计
 */
export async function getAlertStats() {
  const db = getDatabase()
  
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'active') as active_count,
      COUNT(*) FILTER (WHERE status = 'handled') as handled_count,
      COUNT(*) FILTER (WHERE status = 'ignored') as ignored_count,
      COUNT(*) FILTER (WHERE alert_level = 'danger' AND status = 'active') as danger_count,
      COUNT(*) FILTER (WHERE alert_level = 'warning' AND status = 'active') as warning_count,
      COUNT(*) FILTER (WHERE alert_level = 'info' AND status = 'active') as info_count
    FROM alert_logs
  `).get()
  
  return stats
}

export default {
  // 消息
  getMessages,
  getUnreadCount,
  getRecentMessages,
  createMessage,
  createMessages,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteMessage,
  getMessageById,
  // 审批
  getApprovals,
  getPendingApprovalCount,
  createApproval,
  processApproval,
  getApprovalById,
  getApprovalByBusinessId,
  // 预警
  getAlertRules,
  getAlertRuleById,
  updateAlertRule,
  getAlertLogs,
  getActiveAlertCount,
  createAlertLog,
  handleAlert,
  ignoreAlert,
  getAlertStats
}
