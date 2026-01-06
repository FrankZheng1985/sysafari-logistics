/**
 * 统一审批控制器
 * 提供统一审批的 API 接口
 */

import { success, badRequest, notFound, serverError } from '../../utils/response.js'
import * as unifiedApprovalService from '../../services/unifiedApprovalService.js'
import { getDatabase } from '../../config/database.js'

// ==================== 获取审批列表 ====================

/**
 * 获取统一审批列表
 * GET /api/system/unified-approvals
 */
export async function getApprovals(req, res) {
  try {
    const { status, category, approvalType, page = 1, pageSize = 20 } = req.query
    const userRole = req.user?.role
    
    const db = getDatabase()
    
    // 构建查询
    let query = 'SELECT * FROM unified_approvals WHERE 1=1'
    const params = []
    let paramIndex = 0
    
    if (status && status !== 'all') {
      params.push(status)
      query += ` AND status = $${++paramIndex}`
    }
    
    if (category && category !== 'all') {
      params.push(category)
      query += ` AND category = $${++paramIndex}`
    }
    
    if (approvalType && approvalType !== 'all') {
      params.push(approvalType)
      query += ` AND approval_type = $${++paramIndex}`
    }
    
    // 非管理员只能看到可审批的类型
    if (!['admin', 'boss'].includes(userRole)) {
      // 获取该角色可审批的操作类型
      const triggerResult = await db.pool.query(`
        SELECT operation_code FROM sensitive_operations 
        WHERE $1 = ANY(approver_roles) AND is_active = TRUE
      `, [userRole])
      
      const approvalTypes = triggerResult.rows.map(r => r.operation_code)
      
      if (approvalTypes.length > 0) {
        params.push(approvalTypes)
        query += ` AND approval_type = ANY($${++paramIndex})`
      } else {
        // 如果没有可审批类型，返回空列表
        return success(res, { list: [], total: 0, page: parseInt(page), pageSize: parseInt(pageSize) })
      }
    }
    
    // 计算总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)')
    const countResult = await db.pool.query(countQuery, params)
    const total = parseInt(countResult.rows[0].count)
    
    // 分页
    query += ' ORDER BY CASE WHEN status = \'pending\' THEN 0 ELSE 1 END, priority DESC, created_at DESC'
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    params.push(parseInt(pageSize), offset)
    query += ` LIMIT $${++paramIndex} OFFSET $${++paramIndex}`
    
    const result = await db.pool.query(query, params)
    
    return success(res, {
      list: result.rows,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    })
  } catch (error) {
    console.error('获取统一审批列表失败:', error)
    return serverError(res, '获取审批列表失败')
  }
}

/**
 * 获取待审批数量
 * GET /api/system/unified-approvals/pending-count
 */
export async function getPendingCount(req, res) {
  try {
    const userRole = req.user?.role
    const db = getDatabase()
    
    let query = `SELECT COUNT(*) FROM unified_approvals WHERE status = 'pending'`
    const params = []
    
    // 非管理员只统计可审批的类型
    if (!['admin', 'boss'].includes(userRole)) {
      const triggerResult = await db.pool.query(`
        SELECT operation_code FROM sensitive_operations 
        WHERE $1 = ANY(approver_roles) AND is_active = TRUE
      `, [userRole])
      
      const approvalTypes = triggerResult.rows.map(r => r.operation_code)
      
      if (approvalTypes.length > 0) {
        params.push(approvalTypes)
        query += ` AND approval_type = ANY($1)`
      } else {
        return success(res, { count: 0 })
      }
    }
    
    const result = await db.pool.query(query, params)
    return success(res, { count: parseInt(result.rows[0].count) })
  } catch (error) {
    console.error('获取待审批数量失败:', error)
    return serverError(res, '获取待审批数量失败')
  }
}

/**
 * 获取审批详情
 * GET /api/system/unified-approvals/:id
 */
export async function getApprovalById(req, res) {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    const result = await db.pool.query(
      'SELECT * FROM unified_approvals WHERE id = $1',
      [id]
    )
    
    if (result.rows.length === 0) {
      return notFound(res, '审批不存在')
    }
    
    return success(res, result.rows[0])
  } catch (error) {
    console.error('获取审批详情失败:', error)
    return serverError(res, '获取审批详情失败')
  }
}

// ==================== 审批操作 ====================

/**
 * 通过审批
 * POST /api/system/unified-approvals/:id/approve
 */
export async function approve(req, res) {
  try {
    const { id } = req.params
    const { comment } = req.body
    const user = req.user
    
    const result = await unifiedApprovalService.approve(
      id,
      user.id,
      user.name,
      user.role,
      comment || ''
    )
    
    if (!result.success) {
      return badRequest(res, result.error)
    }
    
    return success(res, null, '审批通过')
  } catch (error) {
    console.error('审批通过失败:', error)
    return serverError(res, '审批通过失败')
  }
}

/**
 * 拒绝审批
 * POST /api/system/unified-approvals/:id/reject
 */
export async function reject(req, res) {
  try {
    const { id } = req.params
    const { reason } = req.body
    const user = req.user
    
    if (!reason) {
      return badRequest(res, '请填写拒绝原因')
    }
    
    const result = await unifiedApprovalService.reject(
      id,
      user.id,
      user.name,
      user.role,
      reason
    )
    
    if (!result.success) {
      return badRequest(res, result.error)
    }
    
    return success(res, null, '已拒绝')
  } catch (error) {
    console.error('审批拒绝失败:', error)
    return serverError(res, '审批拒绝失败')
  }
}

/**
 * 获取我的申请列表
 * GET /api/system/unified-approvals/my-requests
 */
export async function getMyRequests(req, res) {
  try {
    const { status, page = 1, pageSize = 20 } = req.query
    const userId = req.user?.id
    const db = getDatabase()
    
    let query = 'SELECT * FROM unified_approvals WHERE applicant_id = $1'
    const params = [userId]
    let paramIndex = 1
    
    if (status && status !== 'all') {
      params.push(status)
      query += ` AND status = $${++paramIndex}`
    }
    
    // 计算总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)')
    const countResult = await db.pool.query(countQuery, params)
    const total = parseInt(countResult.rows[0].count)
    
    // 分页
    query += ' ORDER BY created_at DESC'
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    params.push(parseInt(pageSize), offset)
    query += ` LIMIT $${++paramIndex} OFFSET $${++paramIndex}`
    
    const result = await db.pool.query(query, params)
    
    return success(res, {
      list: result.rows,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    })
  } catch (error) {
    console.error('获取我的申请列表失败:', error)
    return serverError(res, '获取申请列表失败')
  }
}

export default {
  getApprovals,
  getPendingCount,
  getApprovalById,
  approve,
  reject,
  getMyRequests
}

