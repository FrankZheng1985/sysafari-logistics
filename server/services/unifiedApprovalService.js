/**
 * 统一审批服务
 * 提供所有业务模块的审批功能
 */

import { getDatabase } from '../config/database.js'

// ==================== 检查是否需要审批 ====================

/**
 * 检查操作是否需要审批
 * @param {string} operationCode 操作代码（如 SUPPLIER_DELETE）
 * @param {Object} context 上下文（如金额等）
 * @returns {Promise<{required: boolean, trigger: Object|null}>}
 */
export async function checkRequiresApproval(operationCode, context = {}) {
  const db = getDatabase()
  
  try {
    // 检查审批是否全局启用
    const configResult = await db.pool.query(`
      SELECT config_value FROM approval_configs 
      WHERE config_key = 'approval_enabled'
    `)
    
    if (configResult.rows.length > 0 && configResult.rows[0].config_value === 'false') {
      return { required: false, trigger: null }
    }
    
    // 查询触发点配置
    const triggerResult = await db.pool.query(`
      SELECT * FROM sensitive_operations 
      WHERE operation_code = $1 AND is_active = TRUE AND requires_approval = TRUE
    `, [operationCode])
    
    if (triggerResult.rows.length === 0) {
      return { required: false, trigger: null }
    }
    
    const trigger = triggerResult.rows[0]
    
    // 检查触发条件（如金额阈值）
    if (trigger.trigger_condition) {
      const condition = typeof trigger.trigger_condition === 'string'
        ? JSON.parse(trigger.trigger_condition)
        : trigger.trigger_condition
      
      // 金额阈值检查
      if (condition.amount_threshold && context.amount !== undefined) {
        if (context.amount < condition.amount_threshold) {
          return { required: false, trigger: null }
        }
      }
    }
    
    return { required: true, trigger }
  } catch (error) {
    console.error('检查审批需求失败:', error)
    return { required: false, trigger: null }
  }
}

// ==================== 创建审批 ====================

/**
 * 创建审批请求
 * @param {Object} params 审批参数
 * @returns {Promise<{success: boolean, approval?: Object, error?: string}>}
 */
export async function createApproval(params) {
  const db = getDatabase()
  
  try {
    const {
      operationCode,      // 操作代码
      category,           // 分类：business/system/finance
      title,              // 审批标题
      content,            // 审批内容描述
      businessId,         // 关联业务ID
      businessTable,      // 关联业务表
      amount,             // 金额
      currency = 'EUR',   // 币种
      requestData,        // 完整请求数据
      applicantId,        // 申请人ID
      applicantName,      // 申请人姓名
      applicantRole,      // 申请人角色
      applicantDept,      // 申请人部门
      priority = 'normal',// 优先级
      expiresInHours = 72 // 过期时间
    } = params
    
    if (!operationCode || !title || !applicantId) {
      return { success: false, error: '缺少必填参数：operationCode, title, applicantId' }
    }
    
    // 计算过期时间
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + expiresInHours)
    
    // 获取触发点信息
    const triggerResult = await db.pool.query(
      'SELECT * FROM sensitive_operations WHERE operation_code = $1',
      [operationCode]
    )
    
    const approvalType = operationCode
    const approvalCategory = category || (triggerResult.rows[0]?.category || 'business')
    
    // 创建审批记录
    const result = await db.pool.query(`
      INSERT INTO unified_approvals (
        category, approval_type, business_id, business_table,
        title, content, amount, currency, request_data,
        applicant_id, applicant_name, applicant_role, applicant_dept,
        priority, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      approvalCategory,
      approvalType,
      businessId || null,
      businessTable || null,
      title,
      content || '',
      amount || null,
      currency,
      requestData ? JSON.stringify(requestData) : null,
      applicantId,
      applicantName || '',
      applicantRole || '',
      applicantDept || null,
      priority,
      expiresAt.toISOString()
    ])
    
    const approval = result.rows[0]
    
    // 发送通知给审批人
    await notifyApprovers(approval, triggerResult.rows[0])
    
    return { success: true, approval }
  } catch (error) {
    console.error('创建审批失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 检查是否需要审批，如果需要则创建审批
 * 这是业务模块调用的主要入口
 * @param {string} operationCode 操作代码
 * @param {Object} approvalData 审批数据
 * @returns {Promise<{needsApproval: boolean, approval?: Object}>}
 */
export async function checkAndCreate(operationCode, approvalData) {
  const { required, trigger } = await checkRequiresApproval(operationCode, approvalData)
  
  if (!required) {
    return { needsApproval: false }
  }
  
  const result = await createApproval({
    operationCode,
    category: trigger?.category,
    ...approvalData
  })
  
  if (result.success) {
    return { needsApproval: true, approval: result.approval }
  } else {
    // 审批创建失败时，根据配置决定是否允许继续操作
    console.error('审批创建失败:', result.error)
    return { needsApproval: false, error: result.error }
  }
}

// ==================== 审批处理 ====================

/**
 * 审批通过
 */
export async function approve(approvalId, approverId, approverName, approverRole, comment = '') {
  const db = getDatabase()
  
  try {
    // 检查审批是否存在且状态正确
    const existing = await db.pool.query(
      'SELECT * FROM unified_approvals WHERE id = $1',
      [approvalId]
    )
    
    if (existing.rows.length === 0) {
      return { success: false, error: '审批不存在' }
    }
    
    const approval = existing.rows[0]
    
    if (approval.status !== 'pending') {
      return { success: false, error: '审批状态不正确' }
    }
    
    // 检查审批人权限
    const hasPermission = await checkApproverPermission(approverRole, approval.approval_type)
    if (!hasPermission) {
      return { success: false, error: '无审批权限' }
    }
    
    // 更新审批状态
    await db.pool.query(`
      UPDATE unified_approvals SET
        status = 'approved',
        approver_id = $1,
        approver_name = $2,
        approver_role = $3,
        approval_comment = $4,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = $5
    `, [approverId, approverName, approverRole, comment, approvalId])
    
    // 执行审批通过后的操作
    await executeApprovedAction(approval)
    
    // 发送通知给申请人
    await notifyApplicant(approval, 'approved', comment)
    
    return { success: true }
  } catch (error) {
    console.error('审批通过失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 审批拒绝
 */
export async function reject(approvalId, approverId, approverName, approverRole, reason) {
  const db = getDatabase()
  
  try {
    // 检查审批是否存在
    const existing = await db.pool.query(
      'SELECT * FROM unified_approvals WHERE id = $1',
      [approvalId]
    )
    
    if (existing.rows.length === 0) {
      return { success: false, error: '审批不存在' }
    }
    
    const approval = existing.rows[0]
    
    if (approval.status !== 'pending') {
      return { success: false, error: '审批状态不正确' }
    }
    
    // 更新审批状态
    await db.pool.query(`
      UPDATE unified_approvals SET
        status = 'rejected',
        approver_id = $1,
        approver_name = $2,
        approver_role = $3,
        rejection_reason = $4,
        rejected_at = NOW(),
        updated_at = NOW()
      WHERE id = $5
    `, [approverId, approverName, approverRole, reason, approvalId])
    
    // 发送通知给申请人
    await notifyApplicant(approval, 'rejected', reason)
    
    return { success: true }
  } catch (error) {
    console.error('审批拒绝失败:', error)
    return { success: false, error: error.message }
  }
}

// ==================== 查询审批 ====================

/**
 * 获取审批列表
 */
export async function getApprovals(filters = {}) {
  const db = getDatabase()
  
  try {
    const {
      status,
      category,
      approvalType,
      applicantId,
      approverId,
      page = 1,
      pageSize = 20
    } = filters
    
    let query = 'SELECT * FROM unified_approvals WHERE 1=1'
    const params = []
    let paramIndex = 0
    
    if (status) {
      params.push(status)
      query += ` AND status = $${++paramIndex}`
    }
    
    if (category) {
      params.push(category)
      query += ` AND category = $${++paramIndex}`
    }
    
    if (approvalType) {
      params.push(approvalType)
      query += ` AND approval_type = $${++paramIndex}`
    }
    
    if (applicantId) {
      params.push(applicantId)
      query += ` AND applicant_id = $${++paramIndex}`
    }
    
    query += ' ORDER BY created_at DESC'
    
    // 计算分页
    const offset = (page - 1) * pageSize
    params.push(pageSize, offset)
    query += ` LIMIT $${++paramIndex} OFFSET $${++paramIndex}`
    
    const result = await db.pool.query(query, params)
    
    // 获取总数
    let countQuery = 'SELECT COUNT(*) FROM unified_approvals WHERE 1=1'
    const countParams = params.slice(0, -2) // 去除分页参数
    
    if (status) countQuery += ' AND status = $1'
    if (category) countQuery += ` AND category = $${countParams.indexOf(category) + 1}`
    
    const countResult = await db.pool.query(countQuery, countParams)
    
    return {
      success: true,
      data: {
        list: result.rows,
        total: parseInt(countResult.rows[0].count),
        page,
        pageSize
      }
    }
  } catch (error) {
    console.error('获取审批列表失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 获取待审批列表（根据审批人角色筛选）
 */
export async function getPendingApprovals(approverRole, page = 1, pageSize = 20) {
  const db = getDatabase()
  
  try {
    // 获取该角色可审批的操作类型
    const triggerResult = await db.pool.query(`
      SELECT operation_code FROM sensitive_operations 
      WHERE $1 = ANY(approver_roles) OR 'admin' = ANY(approver_roles)
    `, [approverRole])
    
    const approvalTypes = triggerResult.rows.map(r => r.operation_code)
    
    if (approvalTypes.length === 0 && approverRole !== 'admin') {
      return { success: true, data: { list: [], total: 0, page, pageSize } }
    }
    
    let query = `
      SELECT * FROM unified_approvals 
      WHERE status = 'pending'
    `
    const params = []
    
    if (approverRole !== 'admin' && approvalTypes.length > 0) {
      params.push(approvalTypes)
      query += ` AND approval_type = ANY($1)`
    }
    
    query += ' ORDER BY priority DESC, created_at ASC'
    
    const offset = (page - 1) * pageSize
    params.push(pageSize, offset)
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`
    
    const result = await db.pool.query(query, params)
    
    return {
      success: true,
      data: {
        list: result.rows,
        total: result.rows.length,
        page,
        pageSize
      }
    }
  } catch (error) {
    console.error('获取待审批列表失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 获取我的申请列表
 */
export async function getMyApprovals(applicantId, page = 1, pageSize = 20) {
  return getApprovals({ applicantId, page, pageSize })
}

/**
 * 获取审批详情
 */
export async function getApprovalById(id) {
  const db = getDatabase()
  
  try {
    const result = await db.pool.query(
      'SELECT * FROM unified_approvals WHERE id = $1',
      [id]
    )
    
    if (result.rows.length === 0) {
      return { success: false, error: '审批不存在' }
    }
    
    return { success: true, data: result.rows[0] }
  } catch (error) {
    console.error('获取审批详情失败:', error)
    return { success: false, error: error.message }
  }
}

// ==================== 辅助函数 ====================

/**
 * 检查审批人权限
 */
async function checkApproverPermission(approverRole, approvalType) {
  if (approverRole === 'admin') return true
  
  const db = getDatabase()
  
  try {
    const result = await db.pool.query(`
      SELECT approver_roles FROM sensitive_operations 
      WHERE operation_code = $1 AND is_active = TRUE
    `, [approvalType])
    
    if (result.rows.length === 0) {
      // 默认只有 admin 和 boss 可审批
      return ['admin', 'boss'].includes(approverRole)
    }
    
    const approverRoles = result.rows[0].approver_roles || []
    return approverRoles.includes(approverRole)
  } catch (error) {
    console.error('检查审批权限失败:', error)
    return false
  }
}

/**
 * 执行审批通过后的操作
 */
async function executeApprovedAction(approval) {
  const db = getDatabase()
  
  try {
    // 根据审批类型执行不同的操作
    let result = null
    
    switch (approval.approval_type) {
      case 'USER_CREATE':
        // 执行用户创建（需要调用用户管理模块）
        result = { executed: true, action: 'user_create' }
        break
        
      case 'USER_DELETE':
        // 执行用户删除
        result = { executed: true, action: 'user_delete' }
        break
        
      case 'SUPPLIER_DELETE':
        // 执行供应商删除
        if (approval.business_id) {
          await db.pool.query(
            'DELETE FROM suppliers WHERE id = $1',
            [approval.business_id]
          )
          result = { executed: true, action: 'supplier_delete' }
        }
        break
        
      case 'FEE_SUPPLEMENT':
        // 费用审批通过，更新费用状态
        if (approval.business_id) {
          await db.pool.query(
            "UPDATE fees SET approval_status = 'approved' WHERE id = $1",
            [approval.business_id]
          )
          result = { executed: true, action: 'fee_approve' }
        }
        break
        
      default:
        // 其他类型可能需要手动执行
        result = { executed: false, reason: '需要手动执行' }
    }
    
    // 记录执行结果
    if (result) {
      await db.pool.query(`
        UPDATE unified_approvals SET
          is_executed = $1,
          executed_at = CASE WHEN $1 THEN NOW() ELSE executed_at END,
          execution_result = $2
        WHERE id = $3
      `, [result.executed !== false, JSON.stringify(result), approval.id])
    }
    
    return result
  } catch (error) {
    console.error('执行审批后操作失败:', error)
    return { executed: false, error: error.message }
  }
}

/**
 * 通知审批人
 */
async function notifyApprovers(approval, trigger) {
  const db = getDatabase()
  
  try {
    // 获取可审批的角色
    const approverRoles = trigger?.approver_roles || ['admin', 'boss']
    
    // 查找具有这些角色的用户
    const usersResult = await db.pool.query(`
      SELECT id, name FROM users 
      WHERE role = ANY($1) AND status = 'active'
    `, [approverRoles])
    
    // 创建消息通知（如果有消息模块）
    for (const user of usersResult.rows) {
      try {
        await db.pool.query(`
          INSERT INTO messages (
            type, title, content, sender_id, sender_name,
            receiver_id, receiver_name, related_type, related_id
          ) VALUES (
            'approval', '新的审批待处理',
            $1, $2, $3, $4, $5, 'unified_approval', $6
          )
        `, [
          `${approval.applicant_name || '用户'} 提交了 "${approval.title}"，请及时处理。`,
          approval.applicant_id,
          approval.applicant_name,
          user.id,
          user.name,
          approval.id
        ])
      } catch (e) {
        // 消息创建失败不影响主流程
        console.warn('创建审批通知失败:', e.message)
      }
    }
  } catch (error) {
    console.error('通知审批人失败:', error)
  }
}

/**
 * 通知申请人
 */
async function notifyApplicant(approval, status, comment) {
  const db = getDatabase()
  
  try {
    const statusText = status === 'approved' ? '已通过' : '已拒绝'
    const content = status === 'approved'
      ? `您的审批申请 "${approval.title}" 已通过。${comment ? `审批意见：${comment}` : ''}`
      : `您的审批申请 "${approval.title}" 已被拒绝。原因：${comment || '无'}`
    
    await db.pool.query(`
      INSERT INTO messages (
        type, title, content, sender_id, sender_name,
        receiver_id, receiver_name, related_type, related_id
      ) VALUES (
        'approval', '审批结果通知',
        $1, $2, $3, $4, $5, 'unified_approval', $6
      )
    `, [
      content,
      approval.approver_id,
      approval.approver_name,
      approval.applicant_id,
      approval.applicant_name,
      approval.id
    ])
  } catch (error) {
    console.error('通知申请人失败:', error)
  }
}

// ==================== 导出 ====================

export default {
  checkRequiresApproval,
  createApproval,
  checkAndCreate,
  approve,
  reject,
  getApprovals,
  getPendingApprovals,
  getMyApprovals,
  getApprovalById
}

