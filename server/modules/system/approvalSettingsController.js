/**
 * 审批权限设置控制器
 * 管理审批触发点配置、申请新触发点、开发任务管理
 */

import { getDatabase } from '../../config/database.js'
import { success, badRequest, notFound, serverError } from '../../utils/response.js'

// ==================== 触发点管理 ====================

/**
 * 获取所有审批触发点列表
 * 包括可用的、开发中的、已申请的
 */
export async function getApprovalTriggers(req, res) {
  try {
    const db = getDatabase()
    const { category, status } = req.query
    
    let query = `
      SELECT 
        id,
        operation_code,
        operation_name,
        operation_type,
        description,
        requires_approval,
        approval_level,
        approver_roles,
        business_module,
        trigger_action,
        trigger_condition,
        category,
        availability_status,
        is_active,
        created_at,
        updated_at
      FROM sensitive_operations
      WHERE 1=1
    `
    const params = []
    
    if (category) {
      params.push(category)
      query += ` AND category = $${params.length}`
    }
    
    if (status) {
      params.push(status)
      query += ` AND availability_status = $${params.length}`
    }
    
    query += ' ORDER BY category, business_module, trigger_action'
    
    const result = await db.pool.query(query, params)
    
    // 同时获取申请中的触发点
    const requestsResult = await db.pool.query(`
      SELECT 
        id,
        business_module,
        trigger_action,
        module_name,
        action_name,
        description,
        expected_roles,
        status,
        requested_by,
        requested_by_name,
        created_at
      FROM approval_trigger_requests
      WHERE status IN ('requested', 'developing')
      ORDER BY created_at DESC
    `)
    
    return success(res, {
      triggers: result.rows,
      pendingRequests: requestsResult.rows
    })
  } catch (error) {
    console.error('获取审批触发点列表失败:', error)
    return serverError(res, '获取审批触发点列表失败')
  }
}

/**
 * 更新触发点配置
 */
export async function updateApprovalTrigger(req, res) {
  try {
    const db = getDatabase()
    const { id } = req.params
    const { 
      requires_approval, 
      approval_level, 
      approver_roles, 
      trigger_condition,
      is_active 
    } = req.body
    
    // 检查触发点是否存在
    const existing = await db.pool.query(
      'SELECT id FROM sensitive_operations WHERE id = $1',
      [id]
    )
    
    if (existing.rows.length === 0) {
      return notFound(res, '触发点不存在')
    }
    
    // 更新配置
    await db.pool.query(`
      UPDATE sensitive_operations SET
        requires_approval = COALESCE($1, requires_approval),
        approval_level = COALESCE($2, approval_level),
        approver_roles = COALESCE($3, approver_roles),
        trigger_condition = COALESCE($4, trigger_condition),
        is_active = COALESCE($5, is_active),
        updated_at = NOW()
      WHERE id = $6
    `, [requires_approval, approval_level, approver_roles, trigger_condition, is_active, id])
    
    return success(res, null, '更新成功')
  } catch (error) {
    console.error('更新触发点配置失败:', error)
    return serverError(res, '更新触发点配置失败')
  }
}

/**
 * 切换触发点启用状态
 */
export async function toggleApprovalTrigger(req, res) {
  try {
    const db = getDatabase()
    const { id } = req.params
    
    const result = await db.pool.query(`
      UPDATE sensitive_operations SET
        is_active = NOT is_active,
        updated_at = NOW()
      WHERE id = $1
      RETURNING is_active
    `, [id])
    
    if (result.rows.length === 0) {
      return notFound(res, '触发点不存在')
    }
    
    return success(res, { is_active: result.rows[0].is_active }, result.rows[0].is_active ? '已启用' : '已禁用')
  } catch (error) {
    console.error('切换触发点状态失败:', error)
    return serverError(res, '切换触发点状态失败')
  }
}

// ==================== 申请新触发点 ====================

/**
 * 提交新触发点申请
 */
export async function createTriggerRequest(req, res) {
  try {
    const db = getDatabase()
    const { 
      business_module, 
      trigger_action, 
      module_name,
      action_name,
      description, 
      expected_roles 
    } = req.body
    
    if (!business_module || !trigger_action) {
      return badRequest(res, '业务模块和触发操作为必填项')
    }
    
    // 检查是否已存在相同的触发点
    const existing = await db.pool.query(`
      SELECT id FROM sensitive_operations 
      WHERE business_module = $1 AND trigger_action = $2
    `, [business_module, trigger_action])
    
    if (existing.rows.length > 0) {
      return badRequest(res, '该触发点已存在，请直接配置')
    }
    
    // 检查是否已有相同的申请
    const existingRequest = await db.pool.query(`
      SELECT id FROM approval_trigger_requests 
      WHERE business_module = $1 AND trigger_action = $2 AND status IN ('requested', 'developing')
    `, [business_module, trigger_action])
    
    if (existingRequest.rows.length > 0) {
      return badRequest(res, '已有相同的申请在处理中')
    }
    
    // 创建申请
    const result = await db.pool.query(`
      INSERT INTO approval_trigger_requests (
        business_module, trigger_action, module_name, action_name,
        description, expected_roles, 
        requested_by, requested_by_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      business_module, 
      trigger_action, 
      module_name,
      action_name,
      description, 
      expected_roles,
      req.user?.id,
      req.user?.name
    ])
    
    return success(res, result.rows[0], '申请已提交')
  } catch (error) {
    console.error('提交触发点申请失败:', error)
    return serverError(res, '提交触发点申请失败')
  }
}

/**
 * 获取触发点申请列表
 */
export async function getTriggerRequests(req, res) {
  try {
    const db = getDatabase()
    const { status } = req.query
    
    let query = `
      SELECT * FROM approval_trigger_requests
      WHERE 1=1
    `
    const params = []
    
    if (status) {
      params.push(status)
      query += ` AND status = $${params.length}`
    }
    
    query += ' ORDER BY created_at DESC'
    
    const result = await db.pool.query(query, params)
    
    return success(res, result.rows)
  } catch (error) {
    console.error('获取触发点申请列表失败:', error)
    return serverError(res, '获取触发点申请列表失败')
  }
}

/**
 * 更新申请状态（开发人员操作）
 */
export async function updateTriggerRequestStatus(req, res) {
  try {
    const db = getDatabase()
    const { id } = req.params
    const { status, developer_notes } = req.body
    
    if (!['developing', 'completed', 'rejected'].includes(status)) {
      return badRequest(res, '无效的状态')
    }
    
    const updates = {
      status,
      developer_notes,
      updated_at: 'NOW()'
    }
    
    if (status === 'completed') {
      updates.completed_by = req.user?.id
      updates.completed_by_name = req.user?.name
      updates.completed_at = 'NOW()'
    }
    
    await db.pool.query(`
      UPDATE approval_trigger_requests SET
        status = $1,
        developer_notes = $2,
        completed_by = $3,
        completed_by_name = $4,
        completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
        updated_at = NOW()
      WHERE id = $5
    `, [status, developer_notes, req.user?.id, req.user?.name, id])
    
    // 如果标记为完成，同时在 sensitive_operations 中创建新的触发点
    if (status === 'completed') {
      const request = await db.pool.query(
        'SELECT * FROM approval_trigger_requests WHERE id = $1',
        [id]
      )
      
      if (request.rows.length > 0) {
        const req = request.rows[0]
        const operationCode = `${req.business_module.toUpperCase()}_${req.trigger_action.toUpperCase()}`
        
        await db.pool.query(`
          INSERT INTO sensitive_operations (
            operation_code, operation_name, operation_type, description,
            requires_approval, approval_level, approver_roles,
            business_module, trigger_action, category, availability_status, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'available', TRUE)
          ON CONFLICT (operation_code) DO UPDATE SET
            availability_status = 'available',
            is_active = TRUE,
            updated_at = NOW()
        `, [
          operationCode,
          req.action_name || `${req.module_name}${req.action_name}`,
          `${req.business_module}_management`,
          req.description,
          true,
          1,
          req.expected_roles || ['admin', 'boss'],
          req.business_module,
          req.trigger_action,
          'business'
        ])
      }
    }
    
    return success(res, null, '状态更新成功')
  } catch (error) {
    console.error('更新申请状态失败:', error)
    return serverError(res, '更新申请状态失败')
  }
}

// ==================== 全局配置 ====================

/**
 * 获取审批全局配置
 */
export async function getApprovalConfigs(req, res) {
  try {
    const db = getDatabase()
    
    const result = await db.pool.query(`
      SELECT config_key, config_value, config_type, description, category
      FROM approval_configs
      ORDER BY category, config_key
    `)
    
    // 转换为对象格式
    const configs = {}
    result.rows.forEach(row => {
      let value = row.config_value
      if (row.config_type === 'number') {
        value = Number(value)
      } else if (row.config_type === 'boolean') {
        value = value === 'true'
      } else if (row.config_type === 'json') {
        try {
          value = JSON.parse(value)
        } catch (e) {
          // 保持字符串
        }
      }
      configs[row.config_key] = {
        value,
        type: row.config_type,
        description: row.description,
        category: row.category
      }
    })
    
    return success(res, configs)
  } catch (error) {
    console.error('获取审批配置失败:', error)
    return serverError(res, '获取审批配置失败')
  }
}

/**
 * 更新审批全局配置
 */
export async function updateApprovalConfigs(req, res) {
  try {
    const db = getDatabase()
    const configs = req.body
    
    for (const [key, value] of Object.entries(configs)) {
      const configValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
      
      await db.pool.query(`
        UPDATE approval_configs SET
          config_value = $1,
          updated_at = NOW()
        WHERE config_key = $2
      `, [configValue, key])
    }
    
    return success(res, null, '配置更新成功')
  } catch (error) {
    console.error('更新审批配置失败:', error)
    return serverError(res, '更新审批配置失败')
  }
}

// ==================== 业务模块选项 ====================

/**
 * 获取可用的业务模块列表（用于申请新触发点时选择）
 */
export async function getBusinessModules(req, res) {
  try {
    const modules = [
      { code: 'supplier', name: '供应商管理', actions: ['create', 'delete', 'update'] },
      { code: 'customer', name: '客户管理', actions: ['create', 'delete', 'update'] },
      { code: 'user', name: '用户管理', actions: ['create', 'delete', 'role_change', 'permission_grant'] },
      { code: 'fee', name: '费用管理', actions: ['supplement', 'item_create', 'category_create', 'delete'] },
      { code: 'payment', name: '付款管理', actions: ['request', 'approve', 'cancel'] },
      { code: 'order', name: '订单管理', actions: ['create', 'large_amount', 'cancel'] },
      { code: 'contract', name: '合同管理', actions: ['create', 'sign', 'terminate'] },
      { code: 'quotation', name: '报价管理', actions: ['create', 'approve'] },
      { code: 'invoice', name: '发票管理', actions: ['create', 'void'] },
      { code: 'data', name: '数据管理', actions: ['export', 'import', 'delete'] },
      { code: 'system', name: '系统管理', actions: ['config_change', 'security_change'] }
    ]
    
    const actionNames = {
      create: '创建',
      delete: '删除',
      update: '修改',
      role_change: '角色变更',
      permission_grant: '授予权限',
      supplement: '追加',
      item_create: '新增项目',
      category_create: '新增分类',
      request: '申请',
      approve: '审批',
      cancel: '取消',
      large_amount: '大额',
      sign: '签署',
      terminate: '终止',
      void: '作废',
      export: '导出',
      import: '导入',
      config_change: '配置变更',
      security_change: '安全设置变更'
    }
    
    return success(res, { modules, actionNames })
  } catch (error) {
    console.error('获取业务模块列表失败:', error)
    return serverError(res, '获取业务模块列表失败')
  }
}

// 导出所有方法
export default {
  getApprovalTriggers,
  updateApprovalTrigger,
  toggleApprovalTrigger,
  createTriggerRequest,
  getTriggerRequests,
  updateTriggerRequestStatus,
  getApprovalConfigs,
  updateApprovalConfigs,
  getBusinessModules
}

