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
    const userId = req.user?.id
    
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
    
    // 非管理员需要过滤：可以看到有审批权限的类型 OR 自己提交的审批
    if (!['admin', 'boss'].includes(userRole)) {
      // 获取该角色可审批的操作类型
      const triggerResult = await db.pool.query(`
        SELECT operation_code FROM sensitive_operations 
        WHERE $1 = ANY(approver_roles) AND is_active = TRUE
      `, [userRole])
      
      const approvalTypes = triggerResult.rows.map(r => r.operation_code)
      
      if (approvalTypes.length > 0) {
        // 用户可以看到有审批权限的类型 OR 自己提交的审批
        params.push(approvalTypes)
        params.push(userId || '')
        query += ` AND (approval_type = ANY($${++paramIndex}) OR applicant_id = $${++paramIndex})`
      } else {
        // 没有审批权限，只能看自己提交的审批
        params.push(userId || '')
        query += ` AND applicant_id = $${++paramIndex}`
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
    
    // 处理 request_data JSON 字段，确保前端能正确读取
    // 对于追加费用审批，如果 request_data 中没有 containerNumber，从关联表中补充获取
    const list = await Promise.all(result.rows.map(async (row) => {
      let requestData = row.request_data && typeof row.request_data === 'string' 
        ? JSON.parse(row.request_data) 
        : row.request_data || {}
      
      // 如果是追加费用审批且没有集装箱号，尝试从关联表获取
      if (row.approval_type === 'FEE_SUPPLEMENT' && !requestData.containerNumber && row.business_id) {
        try {
          const feeResult = await db.pool.query(`
            SELECT b.container_number 
            FROM fees f 
            LEFT JOIN bills_of_lading b ON f.bill_id = b.id 
            WHERE f.id = $1
          `, [row.business_id])
          
          if (feeResult.rows[0]?.container_number) {
            requestData = {
              ...requestData,
              containerNumber: feeResult.rows[0].container_number
            }
          }
        } catch (e) {
          // 忽略补充查询错误
        }
      }
      
      return {
        ...row,
        request_data: requestData
      }
    }))
    
    return success(res, {
      list,
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
    const userId = req.user?.id
    const db = getDatabase()
    
    let query = `SELECT COUNT(*) FROM unified_approvals WHERE status = 'pending'`
    const params = []
    let paramIndex = 0
    
    // 非管理员：统计可审批的类型 + 自己提交的审批
    if (!['admin', 'boss'].includes(userRole)) {
      const triggerResult = await db.pool.query(`
        SELECT operation_code FROM sensitive_operations 
        WHERE $1 = ANY(approver_roles) AND is_active = TRUE
      `, [userRole])
      
      const approvalTypes = triggerResult.rows.map(r => r.operation_code)
      
      if (approvalTypes.length > 0) {
        params.push(approvalTypes)
        params.push(userId || '')
        query += ` AND (approval_type = ANY($${++paramIndex}) OR applicant_id = $${++paramIndex})`
      } else {
        // 没有审批权限，只统计自己提交的
        params.push(userId || '')
        query += ` AND applicant_id = $${++paramIndex}`
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
 * 获取审批统计
 * GET /api/system/unified-approvals/stats
 */
export async function getStats(req, res) {
  try {
    const userRole = req.user?.role
    const userId = req.user?.id
    const db = getDatabase()
    
    let baseCondition = ''
    const params = []
    
    // 非管理员：统计可审批的类型 + 自己提交的审批
    if (!['admin', 'boss'].includes(userRole)) {
      const triggerResult = await db.pool.query(`
        SELECT operation_code FROM sensitive_operations 
        WHERE $1 = ANY(approver_roles) AND is_active = TRUE
      `, [userRole])
      
      const approvalTypes = triggerResult.rows.map(r => r.operation_code)
      
      if (approvalTypes.length > 0) {
        params.push(approvalTypes)
        params.push(userId || '')
        baseCondition = 'WHERE (approval_type = ANY($1) OR applicant_id = $2)'
      } else {
        // 没有审批权限，只统计自己提交的
        params.push(userId || '')
        baseCondition = 'WHERE applicant_id = $1'
      }
    }
    
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) as total
      FROM unified_approvals ${baseCondition}
    `
    
    const result = await db.pool.query(query, params)
    const stats = result.rows[0]
    
    return success(res, {
      pending: parseInt(stats.pending) || 0,
      approved: parseInt(stats.approved) || 0,
      rejected: parseInt(stats.rejected) || 0,
      total: parseInt(stats.total) || 0
    })
  } catch (error) {
    console.error('获取审批统计失败:', error)
    return serverError(res, '获取审批统计失败')
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
  getStats,
  getApprovalById,
  approve,
  reject,
  getMyRequests
}

