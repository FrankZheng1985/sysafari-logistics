/**
 * 消息模块 - 数据模型
 */

import { getDatabase } from '../../config/database.js'
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
    UPDATE messages SET is_read = 1, read_at = NOW() WHERE id = $1
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
    UPDATE messages SET is_read = 1, read_at = NOW() WHERE id IN (${placeholders})
  `).run(...ids)
  return { success: true, count: ids.length }
}

/**
 * 标记所有消息为已读
 */
export async function markAllAsRead(receiverId) {
  const db = getDatabase()
  const result = await db.prepare(`
    UPDATE messages SET is_read = 1, read_at = NOW() 
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
 * 根据角色获取可见的审批类型
 * @param {string} userRole - 用户角色
 * @returns {string[]} 可见的审批类型列表
 */
export function getVisibleApprovalTypes(userRole) {
  // admin 和 boss 可以看到所有审批类型
  if (['admin', 'boss'].includes(userRole)) {
    return ['order', 'payment', 'supplier', 'fee', 'inquiry', 'void', 'contract']
  }
  
  // 财务角色可以看到财务相关审批
  if (['finance_manager', 'finance'].includes(userRole)) {
    return ['payment', 'fee', 'void']
  }
  
  // 经理角色可以看到订单、供应商、客户询价审批
  if (['manager', 'czjl'].includes(userRole)) {
    return ['order', 'supplier', 'inquiry', 'contract']
  }
  
  // 操作员角色只能看到订单审批（自己提交的）
  if (['operator', 'do'].includes(userRole)) {
    return ['order']
  }
  
  // 其他角色默认不能看到任何审批
  return []
}

/**
 * 检查用户是否有审批权限
 * @param {string} userRole - 用户角色
 * @param {string} approvalType - 审批类型
 * @returns {boolean} 是否有权限
 */
export function canApprove(userRole, approvalType) {
  // admin 和 boss 可以审批所有类型
  if (['admin', 'boss'].includes(userRole)) {
    return true
  }
  
  // 财务经理可以审批财务相关
  if (userRole === 'finance_manager' && ['payment', 'fee', 'void'].includes(approvalType)) {
    return true
  }
  
  // 操作经理可以审批订单、供应商、客户询价
  if (['manager', 'czjl'].includes(userRole) && ['order', 'supplier', 'inquiry', 'contract'].includes(approvalType)) {
    return true
  }
  
  return false
}

/**
 * 获取有审批权限的角色列表
 * @returns {string[]} 有审批权限的角色
 */
export function getApproverRoles() {
  return ['admin', 'boss', 'finance_manager', 'czjl', 'manager']
}

/**
 * 获取审批列表
 * @param {Object} params
 * @param {string} params.applicantId - 申请人ID
 * @param {string} params.approverId - 审批人ID
 * @param {string} params.userRole - 用户角色（用于权限过滤）
 * @param {string} params.userId - 用户ID
 * @param {string} params.status - 审批状态
 * @param {string} params.approvalType - 审批类型
 * @param {number} params.page - 页码
 * @param {number} params.pageSize - 每页数量
 */
export async function getApprovals(params = {}) {
  const db = getDatabase()
  const { applicantId, approverId, userRole, userId, status, approvalType, page = 1, pageSize = 20 } = params
  
  // 使用默认角色（最低权限）如果没有提供
  const effectiveRole = userRole || 'operator'
  
  // 检查用户是否有权限查看审批
  const approverRoles = getApproverRoles()
  const hasApprovalPermission = approverRoles.includes(effectiveRole)
  
  let whereConditions = ['1=1']
  const queryParams = []
  let paramIndex = 1
  
  // 始终根据用户角色过滤可见的审批类型（admin 和 boss 除外）
  if (!['admin', 'boss'].includes(effectiveRole)) {
    const visibleTypes = getVisibleApprovalTypes(effectiveRole)
    if (visibleTypes.length > 0) {
      const typePlaceholders = visibleTypes.map((_, i) => `$${paramIndex++}`).join(', ')
      whereConditions.push(`approval_type IN (${typePlaceholders})`)
      queryParams.push(...visibleTypes)
    } else {
      // 如果没有可见类型，只能看自己提交的
      whereConditions.push(`applicant_id = $${paramIndex++}`)
      queryParams.push(userId || applicantId || '')
    }
  }
  
  if (applicantId) {
    whereConditions.push(`applicant_id = $${paramIndex++}`)
    queryParams.push(applicantId)
  }
  
  // 对于非管理员审批人，只能看到分配给自己或未分配的审批
  if (approverId && hasApprovalPermission && !['admin', 'boss'].includes(effectiveRole)) {
    whereConditions.push(`(approver_id = $${paramIndex++} OR approver_id IS NULL)`)
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
 * @param {string} approverId - 审批人ID
 * @param {string} userRole - 用户角色（用于判断审批权限）
 */
export async function getPendingApprovalCount(approverId, userRole) {
  const db = getDatabase()
  
  // 使用默认角色（最低权限）如果没有提供
  const effectiveRole = userRole || 'operator'
  
  // 只有有审批权限的角色才能看到待审批数量
  // admin, boss, finance_manager, czjl, manager 有审批权限
  const approverRoles = ['admin', 'boss', 'finance_manager', 'czjl', 'manager']
  
  if (!approverRoles.includes(effectiveRole)) {
    // 普通用户（如 do、operator、finance）没有审批权限，返回0
    return 0
  }
  
  // 根据角色获取可见的审批类型
  const visibleTypes = getVisibleApprovalTypes(effectiveRole)
  
  let sql = `SELECT COUNT(*) as count FROM approvals WHERE status = 'pending'`
  const params = []
  let paramIndex = 1
  
  // 添加类型过滤（admin 和 boss 可以看所有类型）
  if (!['admin', 'boss'].includes(effectiveRole) && visibleTypes.length > 0) {
    const typePlaceholders = visibleTypes.map((_, i) => `$${paramIndex++}`).join(', ')
    sql += ` AND approval_type IN (${typePlaceholders})`
    params.push(...visibleTypes)
  }
  
  // 对于非管理员角色，只能看到分配给自己或未分配审批人的审批
  if (approverId && !['admin', 'boss'].includes(userRole)) {
    sql += ` AND (approver_id = $${paramIndex++} OR approver_id IS NULL)`
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
    SET status = $1, remark = $2, reject_reason = $3, approver_id = $4, approver_name = $5, processed_at = NOW()
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
  
  fields.push(`updated_at = NOW()`)
  
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
 * @param {Object} params - 查询参数
 * @param {string} params.alertType - 预警类型
 * @param {string} params.alertLevel - 预警级别
 * @param {string} params.status - 预警状态
 * @param {string} params.userRole - 用户角色（用于权限过滤）
 * @param {number} params.page - 页码
 * @param {number} params.pageSize - 每页数量
 */
export async function getAlertLogs(params = {}) {
  const db = getDatabase()
  const { alertType, alertLevel, status, userRole, page = 1, pageSize = 20 } = params
  
  let whereConditions = ['1=1']
  const queryParams = []
  let paramIndex = 1
  
  // 始终根据用户角色过滤可见的预警类型（如果没有角色，默认使用最低权限）
  const visibleTypes = getVisibleAlertTypes(userRole || 'operator')
  if (visibleTypes.length > 0) {
    const typePlaceholders = visibleTypes.map((_, i) => `$${paramIndex++}`).join(', ')
    whereConditions.push(`alert_type IN (${typePlaceholders})`)
    queryParams.push(...visibleTypes)
  } else {
    // 没有可见类型，返回空结果
    whereConditions.push('1=0')
  }
  
  // 如果指定了特定类型，还需要检查该类型是否在可见范围内
  if (alertType && alertType !== 'all') {
    if (visibleTypes.includes(alertType)) {
      whereConditions.push(`alert_type = $${paramIndex++}`)
      queryParams.push(alertType)
    } else {
      // 请求的类型不在可见范围内，返回空结果
      whereConditions.push('1=0')
    }
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
 * 根据角色获取可见的预警类型
 * @param {string} userRole - 用户角色
 * @returns {string[]} 可见的预警类型列表
 */
export function getVisibleAlertTypes(userRole) {
  // 所有角色都能看到的预警类型
  const commonTypes = ['order_overdue']
  
  // 财务相关预警 - 只有财务角色能看
  const financeTypes = ['payment_due', 'payment_term_due', 'credit_limit', 'customer_overdue']
  
  // CRM/商务相关预警
  const crmTypes = ['contract_expire']
  
  // 供应商相关预警
  const supplierTypes = ['license_expire']
  
  // 管理员和老板能看所有
  if (['admin', 'boss'].includes(userRole)) {
    return [...commonTypes, ...financeTypes, ...crmTypes, ...supplierTypes]
  }
  
  // 财务角色（finance_manager, finance）能看财务预警
  if (['finance_manager', 'finance'].includes(userRole)) {
    return [...commonTypes, ...financeTypes]
  }
  
  // 经理角色（manager, czjl）能看CRM和供应商预警
  if (['manager', 'czjl'].includes(userRole)) {
    return [...commonTypes, ...crmTypes, ...supplierTypes]
  }
  
  // 其他角色（do, operator等）只能看通用预警
  return commonTypes
}

/**
 * 获取活跃预警数量
 * @param {string} userRole - 用户角色（用于权限过滤）
 */
export async function getActiveAlertCount(userRole) {
  const db = getDatabase()
  
  // 根据角色获取可见的预警类型
  const effectiveRole = userRole || 'operator'
  const visibleTypes = getVisibleAlertTypes(effectiveRole)
  
  // 调试日志
  console.log('[Alert权限调试] getActiveAlertCount - userRole:', userRole, ', effectiveRole:', effectiveRole, ', visibleTypes:', visibleTypes)
  
  if (visibleTypes.length === 0) {
    return 0
  }
  
  // 构建 IN 子句
  const placeholders = visibleTypes.map((_, i) => `$${i + 1}`).join(', ')
  
  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM alert_logs 
    WHERE status = 'active' AND alert_type IN (${placeholders})
  `).get(...visibleTypes)
  
  console.log('[Alert权限调试] getActiveAlertCount - result count:', result.count)
  
  return parseInt(result.count)
}

/**
 * 创建预警日志
 */
export async function createAlertLog(data) {
  const db = getDatabase()
  const id = uuidv4()
  
  await db.prepare(`
    INSERT INTO alert_logs (id, rule_id, rule_name, alert_type, alert_level, title, content, related_type, related_id, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
  `).run(
    id,
    data.ruleId || null,
    data.ruleName || null,
    data.alertType,
    data.alertLevel || 'warning',
    data.title,
    data.content || '',
    data.relatedType || null,
    data.relatedId || null
  )
  
  return { success: true, id }
}

/**
 * 处理预警（标记为已处理）
 */
export async function handleAlert(id, data) {
  const db = getDatabase()
  
  await db.prepare(`
    UPDATE alert_logs 
    SET status = 'handled', handled_by = $1, handled_at = NOW(), handle_remark = $2
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
    SET status = 'ignored', handled_by = $1, handled_at = NOW(), handle_remark = $2
    WHERE id = $3
  `).run(data.handledBy, data.handleRemark || null, id)
  
  return { success: true }
}

/**
 * 获取预警统计
 * @param {string} userRole - 用户角色（用于权限过滤）
 */
export async function getAlertStats(userRole) {
  const db = getDatabase()
  
  // 根据角色获取可见的预警类型
  const visibleTypes = getVisibleAlertTypes(userRole || 'operator')
  
  if (visibleTypes.length === 0) {
    return {
      active_count: 0,
      handled_count: 0,
      ignored_count: 0,
      danger_count: 0,
      warning_count: 0,
      info_count: 0
    }
  }
  
  // 构建 IN 子句
  const placeholders = visibleTypes.map((_, i) => `$${i + 1}`).join(', ')
  
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'active') as active_count,
      COUNT(*) FILTER (WHERE status = 'handled') as handled_count,
      COUNT(*) FILTER (WHERE status = 'ignored') as ignored_count,
      COUNT(*) FILTER (WHERE alert_level = 'danger' AND status = 'active') as danger_count,
      COUNT(*) FILTER (WHERE alert_level = 'warning' AND status = 'active') as warning_count,
      COUNT(*) FILTER (WHERE alert_level = 'info' AND status = 'active') as info_count
    FROM alert_logs
    WHERE alert_type IN (${placeholders})
  `).get(...visibleTypes)
  
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
  getAlertStats,
  getVisibleAlertTypes
}
