/**
 * 消息模块 - 控制器
 */

import * as model from './model.js'
import * as inquiryModel from '../inquiry/model.js'

// ==================== 消息相关 ====================

/**
 * 获取消息列表
 */
export async function getMessages(req, res) {
  try {
    const { receiverId, type, isRead, page, pageSize } = req.query
    const result = await model.getMessages({ receiverId, type, isRead, page, pageSize })
    res.json({ errCode: 200, data: result })
  } catch (error) {
    console.error('获取消息列表失败:', error)
    res.json({ errCode: 500, msg: '获取消息列表失败: ' + error.message })
  }
}

/**
 * 获取未读消息数量
 */
export async function getUnreadCount(req, res) {
  try {
    const { receiverId } = req.query
    if (!receiverId) {
      return res.json({ errCode: 400, msg: '缺少接收人ID' })
    }
    const count = await model.getUnreadCount(receiverId)
    res.json({ errCode: 200, data: { count } })
  } catch (error) {
    console.error('获取未读数量失败:', error)
    res.json({ errCode: 500, msg: '获取未读数量失败: ' + error.message })
  }
}

/**
 * 获取最近消息
 */
export async function getRecentMessages(req, res) {
  try {
    const { receiverId, limit } = req.query
    if (!receiverId) {
      return res.json({ errCode: 400, msg: '缺少接收人ID' })
    }
    const messages = await model.getRecentMessages(receiverId, parseInt(limit) || 5)
    res.json({ errCode: 200, data: messages })
  } catch (error) {
    console.error('获取最近消息失败:', error)
    res.json({ errCode: 500, msg: '获取最近消息失败: ' + error.message })
  }
}

/**
 * 创建消息
 */
export async function createMessage(req, res) {
  try {
    const data = req.body
    if (!data.title || !data.receiverId) {
      return res.json({ errCode: 400, msg: '缺少必填字段' })
    }
    const result = await model.createMessage(data)
    res.json({ errCode: 200, data: result, msg: '消息发送成功' })
  } catch (error) {
    console.error('创建消息失败:', error)
    res.json({ errCode: 500, msg: '创建消息失败: ' + error.message })
  }
}

/**
 * 批量创建消息
 */
export async function createMessages(req, res) {
  try {
    const { messages } = req.body
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.json({ errCode: 400, msg: '缺少消息数据' })
    }
    const result = await model.createMessages(messages)
    res.json({ errCode: 200, data: result, msg: '消息发送成功' })
  } catch (error) {
    console.error('批量创建消息失败:', error)
    res.json({ errCode: 500, msg: '批量创建消息失败: ' + error.message })
  }
}

/**
 * 标记消息为已读
 */
export async function markAsRead(req, res) {
  try {
    const { id } = req.params
    await model.markAsRead(id)
    res.json({ errCode: 200, msg: '已标记为已读' })
  } catch (error) {
    console.error('标记已读失败:', error)
    res.json({ errCode: 500, msg: '标记已读失败: ' + error.message })
  }
}

/**
 * 批量标记消息为已读
 */
export async function markMultipleAsRead(req, res) {
  try {
    const { ids } = req.body
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.json({ errCode: 400, msg: '缺少消息ID列表' })
    }
    const result = await model.markMultipleAsRead(ids)
    res.json({ errCode: 200, data: result, msg: '已标记为已读' })
  } catch (error) {
    console.error('批量标记已读失败:', error)
    res.json({ errCode: 500, msg: '批量标记已读失败: ' + error.message })
  }
}

/**
 * 标记所有消息为已读
 */
export async function markAllAsRead(req, res) {
  try {
    const { receiverId } = req.body
    if (!receiverId) {
      return res.json({ errCode: 400, msg: '缺少接收人ID' })
    }
    const result = await model.markAllAsRead(receiverId)
    res.json({ errCode: 200, data: result, msg: '已全部标记为已读' })
  } catch (error) {
    console.error('标记全部已读失败:', error)
    res.json({ errCode: 500, msg: '标记全部已读失败: ' + error.message })
  }
}

/**
 * 删除消息
 */
export async function deleteMessage(req, res) {
  try {
    const { id } = req.params
    await model.deleteMessage(id)
    res.json({ errCode: 200, msg: '消息删除成功' })
  } catch (error) {
    console.error('删除消息失败:', error)
    res.json({ errCode: 500, msg: '删除消息失败: ' + error.message })
  }
}

/**
 * 获取消息详情
 */
export async function getMessageById(req, res) {
  try {
    const { id } = req.params
    const message = await model.getMessageById(id)
    if (!message) {
      return res.json({ errCode: 404, msg: '消息不存在' })
    }
    res.json({ errCode: 200, data: message })
  } catch (error) {
    console.error('获取消息详情失败:', error)
    res.json({ errCode: 500, msg: '获取消息详情失败: ' + error.message })
  }
}

// ==================== 审批相关 ====================

/**
 * 获取审批列表
 */
export async function getApprovals(req, res) {
  try {
    const { applicantId, approverId, userRole, userId, status, approvalType, page, pageSize } = req.query
    
    // 优先使用请求中的用户角色，否则从 req.user 获取
    let role = userRole
    let currentUserId = userId
    if (!role && req.user?.role) {
      role = req.user.role
    }
    if (!currentUserId && req.user?.id) {
      currentUserId = req.user.id
    }
    
    const result = await model.getApprovals({ 
      applicantId, 
      approverId, 
      userRole: role,
      userId: currentUserId,
      status, 
      approvalType, 
      page, 
      pageSize 
    })
    res.json({ errCode: 200, data: result })
  } catch (error) {
    console.error('获取审批列表失败:', error)
    res.json({ errCode: 500, msg: '获取审批列表失败: ' + error.message })
  }
}

/**
 * 获取待审批数量
 */
export async function getPendingApprovalCount(req, res) {
  try {
    const { approverId, userRole } = req.query
    
    // 优先使用请求中的用户角色，否则从 req.user 获取
    let role = userRole
    if (!role && req.user?.role) {
      role = req.user.role
    }
    
    const count = await model.getPendingApprovalCount(approverId, role)
    res.json({ errCode: 200, data: { count } })
  } catch (error) {
    console.error('获取待审批数量失败:', error)
    res.json({ errCode: 500, msg: '获取待审批数量失败: ' + error.message })
  }
}

/**
 * 创建审批
 */
export async function createApproval(req, res) {
  try {
    const data = req.body
    if (!data.approvalType || !data.title || !data.applicantId) {
      return res.json({ errCode: 400, msg: '缺少必填字段' })
    }
    const result = await model.createApproval(data)
    
    // 创建审批后，发送消息通知审批人
    if (data.approverId) {
      await model.createMessage({
        type: 'approval',
        title: '新的审批待处理',
        content: `${data.applicantName || '用户'} 提交了 "${data.title}"，请及时处理。`,
        senderId: data.applicantId,
        senderName: data.applicantName,
        receiverId: data.approverId,
        receiverName: data.approverName,
        relatedType: 'approval',
        relatedId: result.id
      })
    }
    
    res.json({ errCode: 200, data: result, msg: '审批提交成功' })
  } catch (error) {
    console.error('创建审批失败:', error)
    res.json({ errCode: 500, msg: '创建审批失败: ' + error.message })
  }
}

/**
 * 处理审批
 */
export async function processApproval(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    if (!data.status || !data.approverId) {
      return res.json({ errCode: 400, msg: '缺少必填字段' })
    }
    
    // 获取审批详情
    const approval = await model.getApprovalById(id)
    if (!approval) {
      return res.json({ errCode: 404, msg: '审批不存在' })
    }
    
    if (approval.status !== 'pending') {
      return res.json({ errCode: 400, msg: '该审批已处理' })
    }
    
    // 检查用户是否有权限审批此类型
    const approverRole = data.approverRole || req.user?.role
    if (!approverRole) {
      return res.json({ errCode: 400, msg: '缺少审批人角色信息' })
    }
    
    // 验证审批权限
    const hasPermission = model.canApprove(approverRole, approval.approval_type)
    if (!hasPermission) {
      return res.json({ errCode: 403, msg: '您没有权限审批此类型的请求' })
    }
    
    // 如果审批已分配给特定审批人，检查是否是该审批人
    if (approval.approver_id && approval.approver_id !== data.approverId) {
      // admin 和 boss 可以审批任何已分配的审批
      if (!['admin', 'boss'].includes(approverRole)) {
        return res.json({ errCode: 403, msg: '此审批已分配给其他审批人' })
      }
    }
    
    await model.processApproval(id, data)
    
    // 发送消息通知申请人
    const statusText = data.status === 'approved' ? '通过' : '驳回'
    await model.createMessage({
      type: 'approval',
      title: `审批${statusText}通知`,
      content: `您提交的 "${approval.title}" 已被${statusText}。${data.rejectReason ? '原因: ' + data.rejectReason : ''}`,
      senderId: data.approverId,
      senderName: data.approverName,
      receiverId: approval.applicant_id,
      receiverName: approval.applicant_name,
      relatedType: 'approval',
      relatedId: id
    })
    
    res.json({ errCode: 200, msg: `审批${statusText}成功` })
  } catch (error) {
    console.error('处理审批失败:', error)
    res.json({ errCode: 500, msg: '处理审批失败: ' + error.message })
  }
}

/**
 * 获取审批详情
 */
export async function getApprovalById(req, res) {
  try {
    const { id } = req.params
    const approval = await model.getApprovalById(id)
    if (!approval) {
      return res.json({ errCode: 404, msg: '审批不存在' })
    }
    res.json({ errCode: 200, data: approval })
  } catch (error) {
    console.error('获取审批详情失败:', error)
    res.json({ errCode: 500, msg: '获取审批详情失败: ' + error.message })
  }
}

// ==================== 预警相关 ====================

/**
 * 获取预警规则列表
 */
export async function getAlertRules(req, res) {
  try {
    const { isActive, ruleType } = req.query
    const rules = await model.getAlertRules({ 
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      ruleType 
    })
    res.json({ errCode: 200, data: rules })
  } catch (error) {
    console.error('获取预警规则失败:', error)
    res.json({ errCode: 500, msg: '获取预警规则失败: ' + error.message })
  }
}

/**
 * 更新预警规则
 */
export async function updateAlertRule(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    await model.updateAlertRule(id, data)
    res.json({ errCode: 200, msg: '预警规则更新成功' })
  } catch (error) {
    console.error('更新预警规则失败:', error)
    res.json({ errCode: 500, msg: '更新预警规则失败: ' + error.message })
  }
}

/**
 * 获取预警日志列表
 * 根据用户角色过滤可见的预警
 */
export async function getAlertLogs(req, res) {
  try {
    const { alertType, alertLevel, status, userRole, page, pageSize } = req.query
    
    // 获取用户角色
    let role = userRole
    if (!role && req.user?.role) {
      role = req.user.role
    }
    
    // 调试日志：查看用户角色
    console.log('[Alert权限调试] getAlertLogs - userRole from query:', userRole, ', role from req.user:', req.user?.role, ', final role:', role)
    
    const result = await model.getAlertLogs({ alertType, alertLevel, status, userRole: role, page, pageSize })
    res.json({ errCode: 200, data: result })
  } catch (error) {
    console.error('获取预警日志失败:', error)
    res.json({ errCode: 500, msg: '获取预警日志失败: ' + error.message })
  }
}

/**
 * 获取活跃预警数量
 * 根据用户角色过滤可见的预警
 */
export async function getActiveAlertCount(req, res) {
  try {
    const { userRole } = req.query
    
    // 获取用户角色
    let role = userRole
    if (!role && req.user?.role) {
      role = req.user.role
    }
    
    const count = await model.getActiveAlertCount(role)
    res.json({ errCode: 200, data: { count } })
  } catch (error) {
    console.error('获取活跃预警数量失败:', error)
    res.json({ errCode: 500, msg: '获取活跃预警数量失败: ' + error.message })
  }
}

/**
 * 处理预警
 */
export async function handleAlert(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    if (!data.handledBy) {
      return res.json({ errCode: 400, msg: '缺少处理人信息' })
    }
    
    await model.handleAlert(id, data)
    res.json({ errCode: 200, msg: '预警已处理' })
  } catch (error) {
    console.error('处理预警失败:', error)
    res.json({ errCode: 500, msg: '处理预警失败: ' + error.message })
  }
}

/**
 * 忽略预警
 */
export async function ignoreAlert(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    if (!data.handledBy) {
      return res.json({ errCode: 400, msg: '缺少处理人信息' })
    }
    
    await model.ignoreAlert(id, data)
    res.json({ errCode: 200, msg: '预警已忽略' })
  } catch (error) {
    console.error('忽略预警失败:', error)
    res.json({ errCode: 500, msg: '忽略预警失败: ' + error.message })
  }
}

/**
 * 获取预警统计
 * 根据用户角色过滤可见的预警统计
 */
export async function getAlertStats(req, res) {
  try {
    const { userRole } = req.query
    
    // 获取用户角色
    let role = userRole
    if (!role && req.user?.role) {
      role = req.user.role
    }
    
    // 调试日志：查看用户角色
    console.log('[Alert权限调试] getAlertStats - userRole from query:', userRole, ', role from req.user:', req.user?.role, ', final role:', role)
    
    const stats = await model.getAlertStats(role)
    res.json({ errCode: 200, data: stats })
  } catch (error) {
    console.error('获取预警统计失败:', error)
    res.json({ errCode: 500, msg: '获取预警统计失败: ' + error.message })
  }
}

/**
 * 获取通知概览（未读消息 + 待审批 + 活跃预警 + 询价任务）
 * 根据用户角色过滤可见的审批和预警数量
 */
export async function getNotificationOverview(req, res) {
  try {
    const { userId, userRole } = req.query
    
    // 同时获取用户角色（从请求中获取或从数据库查询）
    let role = userRole
    if (!role && req.user?.role) {
      role = req.user.role
    }
    
    // 调试日志
    console.log('[Alert权限调试] getNotificationOverview - userId:', userId, ', userRole from query:', userRole, ', final role:', role)
    
    // 获取询价任务统计（如果有 userId）
    let inquiryStats = { pendingCount: 0, processingCount: 0, overdueCount: 0, todayCompleted: 0 }
    if (userId) {
      try {
        inquiryStats = await inquiryModel.getTaskStats(userId)
      } catch (err) {
        console.debug('获取询价任务统计失败:', err)
      }
    }
    
    const [unreadCount, pendingCount, alertCount] = await Promise.all([
      userId ? model.getUnreadCount(userId) : 0,
      model.getPendingApprovalCount(userId, role),
      model.getActiveAlertCount(role)
    ])
    
    // 询价待处理数（包括待处理和超时的）
    const pendingInquiries = inquiryStats.pendingCount + inquiryStats.overdueCount
    
    // 调试日志 - 查看各计数结果
    console.log('[Alert权限调试] getNotificationOverview - unreadCount:', unreadCount, ', pendingCount:', pendingCount, ', alertCount:', alertCount, ', pendingInquiries:', pendingInquiries)
    
    res.json({ 
      errCode: 200, 
      data: {
        unreadMessages: unreadCount,
        pendingApprovals: pendingCount,
        activeAlerts: alertCount,
        pendingInquiries: pendingInquiries,
        total: unreadCount + pendingCount + alertCount + pendingInquiries
      }
    })
  } catch (error) {
    console.error('获取通知概览失败:', error)
    res.json({ errCode: 500, msg: '获取通知概览失败: ' + error.message })
  }
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
  // 预警
  getAlertRules,
  updateAlertRule,
  getAlertLogs,
  getActiveAlertCount,
  handleAlert,
  ignoreAlert,
  getAlertStats,
  // 综合
  getNotificationOverview
}
