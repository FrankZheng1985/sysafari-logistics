/**
 * 审批服务
 * 处理敏感操作的审批流程
 */

import { getDatabase } from '../config/database.js'

// ==================== 审批请求管理 ====================

/**
 * 创建审批请求
 * @param {Object} data 请求数据
 * @returns {Object} 创建结果
 */
export async function createApprovalRequest(data) {
  const db = getDatabase()
  
  try {
    const {
      requestType,
      requestTitle,
      requestData,
      targetUserId,
      targetUserName,
      requesterId,
      requesterName,
      requesterRole,
      requesterDepartment,
      priority = 'normal',
      expiresInHours = 72
    } = data
    
    // 计算过期时间
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + expiresInHours)
    
    const result = await db.prepare(`
      INSERT INTO approval_requests (
        request_type, request_title, request_data,
        target_user_id, target_user_name,
        requester_id, requester_name, requester_role, requester_department,
        priority, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `).run(
      requestType,
      requestTitle,
      JSON.stringify(requestData),
      targetUserId || null,
      targetUserName || null,
      requesterId,
      requesterName,
      requesterRole,
      requesterDepartment || null,
      priority,
      expiresAt.toISOString()
    )
    
    const requestId = result.lastInsertRowid
    
    // 记录提交历史
    await addApprovalHistory({
      requestId,
      action: 'submit',
      actionName: '提交审批',
      operatorId: requesterId,
      operatorName: requesterName,
      operatorRole: requesterRole,
      comment: '提交审批请求',
      newStatus: 'pending'
    })
    
    // 获取创建的请求（包含生成的审批单号）
    const createdRequest = await getApprovalRequestById(requestId)
    
    // 创建通知给审批人
    await notifyApprovers(requestId, requestType, requestTitle, requesterName)
    
    return { 
      success: true, 
      data: createdRequest,
      message: '审批请求已提交'
    }
  } catch (error) {
    console.error('创建审批请求失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 获取审批请求详情
 * @param {number} id 请求ID
 * @returns {Object} 请求详情
 */
export async function getApprovalRequestById(id) {
  const db = getDatabase()
  
  const request = await db.prepare(`
    SELECT * FROM approval_requests WHERE id = ?
  `).get(id)
  
  if (!request) return null
  
  return convertRequestToCamelCase(request)
}

/**
 * 获取审批请求列表
 * @param {Object} params 查询参数
 * @returns {Object} 列表结果
 */
export async function getApprovalRequests(params = {}) {
  const db = getDatabase()
  const { 
    status, 
    requestType, 
    requesterId, 
    approverId,
    search,
    page = 1, 
    pageSize = 20 
  } = params
  
  let query = 'SELECT * FROM approval_requests WHERE 1=1'
  const queryParams = []
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (requestType) {
    query += ' AND request_type = ?'
    queryParams.push(requestType)
  }
  
  if (requesterId) {
    query += ' AND requester_id = ?'
    queryParams.push(requesterId)
  }
  
  if (approverId) {
    query += ' AND approver_id = ?'
    queryParams.push(approverId)
  }
  
  if (search) {
    query += ' AND (request_title LIKE ? OR request_no LIKE ? OR requester_name LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertRequestToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 获取待审批列表（给审批人看的）
 * @param {Object} params 查询参数
 * @returns {Object} 列表结果
 */
export async function getPendingApprovals(params = {}) {
  const db = getDatabase()
  const { approverRole, page = 1, pageSize = 20 } = params
  
  // 获取可以被该角色审批的请求类型
  let query = `
    SELECT ar.* FROM approval_requests ar
    WHERE ar.status = 'pending'
  `
  const queryParams = []
  
  // 如果指定了审批人角色，筛选该角色可以审批的请求
  if (approverRole && approverRole !== 'admin') {
    query += `
      AND ar.request_type IN (
        SELECT operation_type FROM sensitive_operations 
        WHERE ? = ANY(approver_roles) OR 'admin' = ANY(approver_roles)
      )
    `
    queryParams.push(approverRole)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT ar.*', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页和排序
  query += ' ORDER BY CASE priority WHEN \'urgent\' THEN 1 WHEN \'high\' THEN 2 WHEN \'normal\' THEN 3 ELSE 4 END, ar.created_at ASC'
  query += ' LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertRequestToCamelCase),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 获取我的申请列表
 * @param {number} userId 用户ID
 * @param {Object} params 查询参数
 * @returns {Object} 列表结果
 */
export async function getMyApprovalRequests(userId, params = {}) {
  return getApprovalRequests({ ...params, requesterId: userId })
}

/**
 * 审批通过
 * @param {number} requestId 请求ID
 * @param {Object} approver 审批人信息
 * @param {string} comment 审批意见
 * @returns {Object} 审批结果
 */
export async function approveRequest(requestId, approver, comment = '') {
  const db = getDatabase()
  
  try {
    // 获取请求
    const request = await getApprovalRequestById(requestId)
    if (!request) {
      return { success: false, error: '审批请求不存在' }
    }
    
    if (request.status !== 'pending') {
      return { success: false, error: '该请求已处理，无法重复审批' }
    }
    
    // 检查审批人权限
    const canApprove = await checkApproverPermission(approver.role, request.requestType)
    if (!canApprove) {
      return { success: false, error: '您没有权限审批此请求' }
    }
    
    // 更新请求状态
    await db.prepare(`
      UPDATE approval_requests 
      SET status = 'approved',
          approver_id = ?,
          approver_name = ?,
          approver_role = ?,
          approval_comment = ?,
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = ?
    `).run(
      approver.id,
      approver.name,
      approver.role,
      comment,
      requestId
    )
    
    // 记录审批历史
    await addApprovalHistory({
      requestId,
      action: 'approve',
      actionName: '审批通过',
      operatorId: approver.id,
      operatorName: approver.name,
      operatorRole: approver.role,
      comment,
      oldStatus: 'pending',
      newStatus: 'approved'
    })
    
    // 执行审批通过后的操作
    const executeResult = await executeApprovedRequest(request)
    
    // 通知申请人
    await notifyRequester(request.requesterId, requestId, 'approved', '您的审批请求已通过')
    
    return { 
      success: true, 
      message: '审批通过',
      executeResult
    }
  } catch (error) {
    console.error('审批通过失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 审批拒绝
 * @param {number} requestId 请求ID
 * @param {Object} approver 审批人信息
 * @param {string} reason 拒绝原因
 * @returns {Object} 审批结果
 */
export async function rejectRequest(requestId, approver, reason = '') {
  const db = getDatabase()
  
  try {
    // 获取请求
    const request = await getApprovalRequestById(requestId)
    if (!request) {
      return { success: false, error: '审批请求不存在' }
    }
    
    if (request.status !== 'pending') {
      return { success: false, error: '该请求已处理，无法重复操作' }
    }
    
    // 检查审批人权限
    const canApprove = await checkApproverPermission(approver.role, request.requestType)
    if (!canApprove) {
      return { success: false, error: '您没有权限处理此请求' }
    }
    
    // 更新请求状态
    await db.prepare(`
      UPDATE approval_requests 
      SET status = 'rejected',
          approver_id = ?,
          approver_name = ?,
          approver_role = ?,
          rejection_reason = ?,
          updated_at = NOW()
      WHERE id = ?
    `).run(
      approver.id,
      approver.name,
      approver.role,
      reason,
      requestId
    )
    
    // 记录审批历史
    await addApprovalHistory({
      requestId,
      action: 'reject',
      actionName: '审批拒绝',
      operatorId: approver.id,
      operatorName: approver.name,
      operatorRole: approver.role,
      comment: reason,
      oldStatus: 'pending',
      newStatus: 'rejected'
    })
    
    // 通知申请人
    await notifyRequester(request.requesterId, requestId, 'rejected', `您的审批请求被拒绝：${reason}`)
    
    return { success: true, message: '已拒绝该请求' }
  } catch (error) {
    console.error('审批拒绝失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 取消审批请求（申请人操作）
 * @param {number} requestId 请求ID
 * @param {Object} user 操作人
 * @param {string} reason 取消原因
 * @returns {Object} 取消结果
 */
export async function cancelRequest(requestId, user, reason = '') {
  const db = getDatabase()
  
  try {
    const request = await getApprovalRequestById(requestId)
    if (!request) {
      return { success: false, error: '审批请求不存在' }
    }
    
    // 只有申请人或管理员可以取消
    if (request.requesterId !== user.id && user.role !== 'admin') {
      return { success: false, error: '您没有权限取消此请求' }
    }
    
    if (request.status !== 'pending') {
      return { success: false, error: '该请求已处理，无法取消' }
    }
    
    await db.prepare(`
      UPDATE approval_requests 
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE id = ?
    `).run(requestId)
    
    await addApprovalHistory({
      requestId,
      action: 'cancel',
      actionName: '取消申请',
      operatorId: user.id,
      operatorName: user.name,
      operatorRole: user.role,
      comment: reason,
      oldStatus: 'pending',
      newStatus: 'cancelled'
    })
    
    return { success: true, message: '审批请求已取消' }
  } catch (error) {
    console.error('取消审批请求失败:', error)
    return { success: false, error: error.message }
  }
}

// ==================== 审批历史管理 ====================

/**
 * 添加审批历史记录
 * @param {Object} data 历史数据
 */
async function addApprovalHistory(data) {
  const db = getDatabase()
  
  await db.prepare(`
    INSERT INTO approval_history (
      request_id, action, action_name,
      operator_id, operator_name, operator_role,
      comment, old_status, new_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `).run(
    data.requestId,
    data.action,
    data.actionName,
    data.operatorId,
    data.operatorName,
    data.operatorRole,
    data.comment || null,
    data.oldStatus || null,
    data.newStatus || null
  )
}

/**
 * 获取审批历史
 * @param {number} requestId 请求ID
 * @returns {Array} 历史记录列表
 */
export async function getApprovalHistory(requestId) {
  const db = getDatabase()
  
  const history = await db.prepare(`
    SELECT * FROM approval_history 
    WHERE request_id = ? 
    ORDER BY created_at ASC
  `).all(requestId)
  
  return history.map(h => ({
    id: h.id,
    requestId: h.request_id,
    action: h.action,
    actionName: h.action_name,
    operatorId: h.operator_id,
    operatorName: h.operator_name,
    operatorRole: h.operator_role,
    comment: h.comment,
    oldStatus: h.old_status,
    newStatus: h.new_status,
    createdAt: h.created_at
  }))
}

// ==================== 审批配置管理 ====================

/**
 * 获取审批配置
 * @param {string} key 配置键（可选）
 * @returns {Object} 配置
 */
export async function getApprovalConfig(key = null) {
  const db = getDatabase()
  
  let query = 'SELECT * FROM approval_configs'
  const params = []
  
  if (key) {
    query += ' WHERE config_key = ?'
    params.push(key)
  }
  
  const configs = await db.prepare(query).all(...params)
  
  // 转换为对象
  const result = {}
  configs.forEach(c => {
    let value = c.config_value
    if (c.config_type === 'number') {
      value = Number(value)
    } else if (c.config_type === 'boolean') {
      value = value === 'true'
    } else if (c.config_type === 'json') {
      try {
        value = JSON.parse(value)
      } catch (e) {
        // 保持原值
      }
    }
    result[c.config_key] = value
  })
  
  return result
}

/**
 * 检查操作是否需要审批
 * @param {string} operationType 操作类型
 * @param {Object} context 上下文信息
 * @returns {boolean} 是否需要审批
 */
export async function requiresApproval(operationType, context = {}) {
  const db = getDatabase()
  
  // 检查是否启用审批
  const config = await getApprovalConfig()
  if (!config.approval_enabled) {
    return false
  }
  
  // 检查敏感操作定义
  const operation = await db.prepare(`
    SELECT * FROM sensitive_operations 
    WHERE operation_code = ? AND is_active = TRUE
  `).get(operationType)
  
  if (!operation) {
    return false
  }
  
  // 特殊检查：财务操作检查金额阈值
  if (operationType.startsWith('FINANCE_') && context.amount) {
    const threshold = config.finance_approval_threshold || 10000
    if (context.amount < threshold) {
      return false
    }
  }
  
  return operation.requires_approval
}

/**
 * 检查审批人权限
 * @param {string} approverRole 审批人角色
 * @param {string} requestType 请求类型
 * @returns {boolean} 是否有权限
 */
async function checkApproverPermission(approverRole, requestType) {
  // admin 可以审批所有请求
  if (approverRole === 'admin') {
    return true
  }
  
  const db = getDatabase()
  
  // 查询敏感操作定义
  const operation = await db.prepare(`
    SELECT approver_roles FROM sensitive_operations 
    WHERE operation_type = ? AND is_active = TRUE
  `).get(requestType)
  
  if (!operation || !operation.approver_roles) {
    // 默认只有 admin 和 boss 可以审批
    return ['admin', 'boss'].includes(approverRole)
  }
  
  // 检查角色是否在允许列表中
  return operation.approver_roles.includes(approverRole)
}

// ==================== 审批执行 ====================

/**
 * 执行审批通过后的操作
 * @param {Object} request 审批请求
 * @returns {Object} 执行结果
 */
async function executeApprovedRequest(request) {
  const db = getDatabase()
  
  try {
    const requestData = typeof request.requestData === 'string' 
      ? JSON.parse(request.requestData) 
      : request.requestData
    
    let result = null
    
    switch (request.requestType) {
      case 'user_create':
        result = await executeUserCreate(requestData)
        break
      case 'user_delete':
        result = await executeUserDelete(requestData)
        break
      case 'role_change':
        result = await executeRoleChange(requestData)
        break
      case 'permission_grant':
        result = await executePermissionGrant(requestData)
        break
      default:
        // 其他类型可能不需要自动执行
        result = { executed: false, reason: '需要手动执行' }
    }
    
    // 标记为已执行
    if (result && result.executed !== false) {
      await db.prepare(`
        UPDATE approval_requests 
        SET is_executed = TRUE,
            executed_at = NOW(),
            execution_result = ?
        WHERE id = ?
      `).run(JSON.stringify(result), request.id)
    }
    
    return result
  } catch (error) {
    console.error('执行审批后操作失败:', error)
    return { executed: false, error: error.message }
  }
}

/**
 * 执行用户创建
 */
async function executeUserCreate(data) {
  // 这里调用用户管理模块的创建函数
  // 实际实现会在 controller 中处理
  return { executed: true, action: 'user_create', data }
}

/**
 * 执行用户删除
 */
async function executeUserDelete(data) {
  const db = getDatabase()
  const { userId } = data
  
  await db.prepare('DELETE FROM users WHERE id = ?').run(userId)
  return { executed: true, action: 'user_delete', userId }
}

/**
 * 执行角色变更
 */
async function executeRoleChange(data) {
  const db = getDatabase()
  const { userId, newRole } = data
  
  await db.prepare('UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?').run(newRole, userId)
  return { executed: true, action: 'role_change', userId, newRole }
}

/**
 * 执行权限授予
 */
async function executePermissionGrant(data) {
  const db = getDatabase()
  const { roleCode, permissionCodes } = data
  
  // 添加权限
  const insertStmt = await db.prepare(
    'INSERT INTO role_permissions (role_code, permission_code) VALUES (?, ?) ON CONFLICT DO NOTHING'
  )
  
  for (const permCode of permissionCodes) {
    await insertStmt.run(roleCode, permCode)
  }
  
  return { executed: true, action: 'permission_grant', roleCode, permissionCodes }
}

// ==================== 通知管理 ====================

/**
 * 通知审批人
 */
async function notifyApprovers(requestId, requestType, title, requesterName) {
  const db = getDatabase()
  
  // 获取可审批的角色
  const config = await getApprovalConfig()
  const approverRoles = config.default_approver_roles || ['admin', 'boss']
  
  // 获取具有这些角色的用户
  const approvers = await db.prepare(`
    SELECT id, name FROM users 
    WHERE role IN (${approverRoles.map(() => '?').join(',')})
      AND status = 'active'
  `).all(...approverRoles)
  
  // 创建通知
  const insertStmt = await db.prepare(`
    INSERT INTO approval_notifications (
      request_id, user_id, user_name, notification_type, title, content, created_at
    ) VALUES (?, ?, ?, 'new_request', ?, ?, NOW())
  `)
  
  for (const approver of approvers) {
    await insertStmt.run(
      requestId,
      approver.id,
      approver.name,
      `新的审批请求：${title}`,
      `${requesterName} 提交了一个${title}的审批请求，请及时处理。`
    )
  }
}

/**
 * 通知申请人
 */
async function notifyRequester(userId, requestId, type, content) {
  const db = getDatabase()
  
  await db.prepare(`
    INSERT INTO approval_notifications (
      request_id, user_id, notification_type, title, content, created_at
    ) VALUES (?, ?, ?, ?, ?, NOW())
  `).run(
    requestId,
    userId,
    type,
    type === 'approved' ? '审批已通过' : '审批已拒绝',
    content
  )
}

/**
 * 获取用户的通知列表
 * @param {number} userId 用户ID
 * @param {Object} params 查询参数
 * @returns {Object} 通知列表
 */
export async function getUserNotifications(userId, params = {}) {
  const db = getDatabase()
  const { unreadOnly = false, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM approval_notifications WHERE user_id = ?'
  const queryParams = [userId]
  
  if (unreadOnly) {
    query += ' AND is_read = FALSE'
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(n => ({
      id: n.id,
      requestId: n.request_id,
      notificationType: n.notification_type,
      title: n.title,
      content: n.content,
      isRead: n.is_read,
      readAt: n.read_at,
      createdAt: n.created_at
    })),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 标记通知为已读
 * @param {number} notificationId 通知ID
 * @param {number} userId 用户ID
 */
export async function markNotificationRead(notificationId, userId) {
  const db = getDatabase()
  
  await db.prepare(`
    UPDATE approval_notifications 
    SET is_read = TRUE, read_at = NOW()
    WHERE id = ? AND user_id = ?
  `).run(notificationId, userId)
}

/**
 * 获取待审批数量
 * @param {string} approverRole 审批人角色
 * @returns {number} 待审批数量
 */
export async function getPendingCount(approverRole) {
  const db = getDatabase()
  
  let query = `SELECT COUNT(*) as count FROM approval_requests WHERE status = 'pending'`
  const params = []
  
  // 如果不是管理员，只统计该角色可审批的请求
  if (approverRole && approverRole !== 'admin') {
    query = `
      SELECT COUNT(*) as count FROM approval_requests ar
      WHERE ar.status = 'pending'
        AND ar.request_type IN (
          SELECT operation_type FROM sensitive_operations 
          WHERE ? = ANY(approver_roles)
        )
    `
    params.push(approverRole)
  }
  
  const result = await db.prepare(query).get(...params)
  return result?.count || 0
}

// ==================== 工具函数 ====================

/**
 * 转换请求数据为驼峰命名
 */
function convertRequestToCamelCase(row) {
  if (!row) return null
  
  let requestData = row.request_data
  if (typeof requestData === 'string') {
    try {
      requestData = JSON.parse(requestData)
    } catch (e) {
      // 保持原值
    }
  }
  
  return {
    id: row.id,
    requestNo: row.request_no,
    requestType: row.request_type,
    requestTitle: row.request_title,
    requestData,
    targetUserId: row.target_user_id,
    targetUserName: row.target_user_name,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    requesterRole: row.requester_role,
    requesterDepartment: row.requester_department,
    approverId: row.approver_id,
    approverName: row.approver_name,
    approverRole: row.approver_role,
    status: row.status,
    priority: row.priority,
    approvalComment: row.approval_comment,
    rejectionReason: row.rejection_reason,
    isExecuted: row.is_executed,
    executedAt: row.executed_at,
    executionResult: row.execution_result,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
    expiresAt: row.expires_at
  }
}

// 导出默认对象
export default {
  createApprovalRequest,
  getApprovalRequestById,
  getApprovalRequests,
  getPendingApprovals,
  getMyApprovalRequests,
  approveRequest,
  rejectRequest,
  cancelRequest,
  getApprovalHistory,
  getApprovalConfig,
  requiresApproval,
  getUserNotifications,
  markNotificationRead,
  getPendingCount
}
