/**
 * 费用项审批模块
 * 处理手动录入费用项的审批流程
 * 审批通过后自动添加到供应商报价库
 * 支持新费用分类审批：审批通过后自动在服务费类别下创建子分类
 */

import { getDatabase, generateId } from '../../config/database.js'
import { createSupplierPrice } from '../supplier/model.js'

// ==================== 审批类型常量 ====================

export const APPROVAL_TYPE = {
  FEE_ITEM: 'fee_item',           // 费用项审批（原有）
  NEW_CATEGORY: 'new_category'    // 新费用分类审批
}

// ==================== 审批状态常量 ====================

export const APPROVAL_STATUS = {
  PENDING: 'pending',     // 待审批
  APPROVED: 'approved',   // 已通过
  REJECTED: 'rejected'    // 已拒绝
}

// ==================== 数据转换函数 ====================

function formatApprovalItem(row) {
  if (!row) return null
  return {
    id: row.id,
    approvalType: row.approval_type || 'fee_item',  // 审批类型
    feeId: row.fee_id,
    feeName: row.fee_name,
    feeNameEn: row.fee_name_en,
    category: row.category,
    parentCategoryId: row.parent_category_id,       // 父级分类ID（新费用分类审批用）
    parentCategoryName: row.parent_category_name,   // 父级分类名称
    amount: parseFloat(row.amount) || 0,
    currency: row.currency,
    unit: row.unit,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    description: row.description,
    requestedBy: row.requested_by,
    requestedByName: row.requested_by_name,
    requestedAt: row.requested_at,
    status: row.status,
    approvedBy: row.approved_by,
    approvedByName: row.approved_by_name,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
    convertedToPriceId: row.converted_to_price_id,
    convertedToCategoryId: row.converted_to_category_id,  // 创建的新分类ID
    convertedAt: row.converted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ==================== CRUD 操作 ====================

/**
 * 获取审批列表
 */
export async function getApprovalList(params = {}) {
  const db = getDatabase()
  const { status, supplierId, requestedBy, page = 1, pageSize = 20 } = params
  
  let sql = 'SELECT * FROM fee_item_approvals WHERE 1=1'
  const queryParams = []
  let paramIndex = 1
  
  if (status) {
    sql += ` AND status = $${paramIndex++}`
    queryParams.push(status)
  }
  
  if (supplierId) {
    sql += ` AND supplier_id = $${paramIndex++}`
    queryParams.push(supplierId)
  }
  
  if (requestedBy) {
    sql += ` AND requested_by = $${paramIndex++}`
    queryParams.push(requestedBy)
  }
  
  // 获取总数
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total')
  const countResult = await db.pool.query(countSql, queryParams)
  const total = parseInt(countResult.rows[0]?.total || 0)
  
  // 分页查询
  sql += ` ORDER BY requested_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const result = await db.pool.query(sql, queryParams)
  
  return {
    list: result.rows.map(formatApprovalItem),
    total,
    page,
    pageSize
  }
}

/**
 * 获取单个审批记录
 */
export async function getApprovalById(id) {
  const db = getDatabase()
  const result = await db.pool.query('SELECT * FROM fee_item_approvals WHERE id = $1', [id])
  return result.rows[0] ? formatApprovalItem(result.rows[0]) : null
}

/**
 * 创建审批申请
 * @param {Object} data - 审批数据
 * @param {string} data.approvalType - 审批类型：'fee_item' | 'new_category'
 * @param {string} data.feeName - 费用名称（新分类名称）
 * @param {string} data.parentCategoryId - 父级分类ID（新费用分类审批用）
 * @param {string} data.parentCategoryName - 父级分类名称
 */
export async function createApproval(data) {
  const db = getDatabase()
  
  const result = await db.pool.query(`
    INSERT INTO fee_item_approvals (
      approval_type, fee_id, fee_name, fee_name_en, category, 
      parent_category_id, parent_category_name,
      amount, currency, unit,
      supplier_id, supplier_name, description,
      requested_by, requested_by_name, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING id
  `, [
    data.approvalType || 'fee_item',
    data.feeId || null,
    data.feeName,
    data.feeNameEn || null,
    data.category || 'other',
    data.parentCategoryId || null,
    data.parentCategoryName || null,
    data.amount || 0,
    data.currency || 'EUR',
    data.unit || '次',
    data.supplierId || null,
    data.supplierName || null,
    data.description || null,
    data.requestedBy || null,
    data.requestedByName || null,
    'pending'
  ])
  
  return { id: result.rows[0].id }
}

/**
 * 审批通过
 * - 费用项审批：通过后自动添加到供应商报价库（如果有供应商ID）
 * - 新费用分类审批：通过后自动在服务费类别下创建子分类
 */
export async function approveItem(id, approverData) {
  const db = getDatabase()
  
  // 获取审批记录
  const approval = await getApprovalById(id)
  if (!approval) {
    throw new Error('审批记录不存在')
  }
  
  if (approval.status !== 'pending') {
    throw new Error('该申请已处理')
  }
  
  let convertedPriceId = null
  let convertedCategoryId = null
  let message = '审批通过'
  
  // 根据审批类型处理
  if (approval.approvalType === 'new_category' && approval.parentCategoryId) {
    // 新费用分类审批：创建子分类
    try {
      // 获取父级分类信息
      const parentResult = await db.pool.query(
        'SELECT level FROM service_fee_categories WHERE id = $1',
        [approval.parentCategoryId]
      )
      const parentLevel = parentResult.rows[0]?.level || 1
      
      // 查询该父级下已有子分类的最大排序值
      const maxSortResult = await db.pool.query(
        'SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM service_fee_categories WHERE parent_id = $1',
        [approval.parentCategoryId]
      )
      const sortOrder = (maxSortResult.rows[0]?.max_sort || 0) + 1
      
      // 生成分类代码：父级代码 + 下划线 + 名称拼音首字母或序号
      const codeResult = await db.pool.query(
        'SELECT code FROM service_fee_categories WHERE id = $1',
        [approval.parentCategoryId]
      )
      const parentCode = codeResult.rows[0]?.code || 'OTHER'
      const newCode = `${parentCode}_SUB${sortOrder}`
      
      // 创建子分类
      const insertResult = await db.pool.query(`
        INSERT INTO service_fee_categories (name, name_en, code, description, sort_order, status, parent_id, level)
        VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
        RETURNING id
      `, [
        approval.feeName,
        approval.feeNameEn || '',
        newCode.toUpperCase(),
        approval.description || `审批通过自动创建 - ${approval.parentCategoryName}的子分类`,
        sortOrder,
        approval.parentCategoryId,
        parentLevel + 1
      ])
      
      convertedCategoryId = insertResult.rows[0]?.id
      message = `审批通过，已在「${approval.parentCategoryName}」下创建子分类「${approval.feeName}」`
      console.log(`✅ 新费用分类审批通过，创建子分类: ${approval.feeName} (ID: ${convertedCategoryId})`)
    } catch (err) {
      console.error('创建费用子分类失败:', err)
      throw new Error(`创建费用子分类失败: ${err.message}`)
    }
  } else if (approval.supplierId) {
    // 费用项审批：自动添加到供应商报价库
    try {
      const priceResult = await createSupplierPrice({
        supplierId: approval.supplierId,
        supplierName: approval.supplierName,
        feeName: approval.feeName,
        feeNameEn: approval.feeNameEn,
        category: approval.category,
        unit: approval.unit || '次',
        price: approval.amount,
        currency: approval.currency,
        remark: `审批通过自动添加 - ${approval.description || ''}`
      })
      convertedPriceId = priceResult.id
      message = '审批通过，费用项已添加到供应商报价库'
    } catch (err) {
      console.error('创建供应商报价失败:', err)
      // 不阻断审批流程，只记录日志
    }
  }
  
  // 更新审批状态
  await db.pool.query(`
    UPDATE fee_item_approvals 
    SET status = 'approved',
        approved_by = $1,
        approved_by_name = $2,
        approved_at = NOW(),
        converted_to_price_id = $3,
        converted_to_category_id = $4,
        converted_at = $5,
        updated_at = NOW()
    WHERE id = $6
  `, [
    approverData.userId || null,
    approverData.userName || null,
    convertedPriceId,
    convertedCategoryId,
    (convertedPriceId || convertedCategoryId) ? new Date().toISOString() : null,
    id
  ])
  
  return {
    success: true,
    convertedPriceId,
    convertedCategoryId,
    message
  }
}

/**
 * 审批拒绝
 */
export async function rejectItem(id, rejectionData) {
  const db = getDatabase()
  
  // 获取审批记录
  const approval = await getApprovalById(id)
  if (!approval) {
    throw new Error('审批记录不存在')
  }
  
  if (approval.status !== 'pending') {
    throw new Error('该申请已处理')
  }
  
  await db.pool.query(`
    UPDATE fee_item_approvals 
    SET status = 'rejected',
        approved_by = $1,
        approved_by_name = $2,
        approved_at = NOW(),
        rejection_reason = $3,
        updated_at = NOW()
    WHERE id = $4
  `, [
    rejectionData.userId || null,
    rejectionData.userName || null,
    rejectionData.reason || '未提供原因',
    id
  ])
  
  return { success: true, message: '审批已拒绝' }
}

/**
 * 删除审批记录
 */
export async function deleteApproval(id) {
  const db = getDatabase()
  await db.pool.query('DELETE FROM fee_item_approvals WHERE id = $1', [id])
  return { success: true }
}

/**
 * 获取待审批数量
 */
export async function getPendingCount() {
  const db = getDatabase()
  const result = await db.pool.query(
    "SELECT COUNT(*) as count FROM fee_item_approvals WHERE status = 'pending'"
  )
  return parseInt(result.rows[0]?.count || 0)
}

/**
 * 获取审批统计
 */
export async function getApprovalStats() {
  const db = getDatabase()
  const result = await db.pool.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM fee_item_approvals
  `)
  
  const row = result.rows[0]
  return {
    total: parseInt(row?.total || 0),
    pending: parseInt(row?.pending || 0),
    approved: parseInt(row?.approved || 0),
    rejected: parseInt(row?.rejected || 0)
  }
}

export default {
  APPROVAL_STATUS,
  APPROVAL_TYPE,
  getApprovalList,
  getApprovalById,
  createApproval,
  approveItem,
  rejectItem,
  deleteApproval,
  getPendingCount,
  getApprovalStats
}

