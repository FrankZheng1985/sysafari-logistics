/**
 * 敏感产品预警检查服务
 * 当查验发生时，检查品名、HS Code、材质是否在敏感产品库中
 * 如果不存在，创建预警并支持发起审批添加
 */

import { getDatabase } from '../../config/database.js'
import * as messageModel from '../message/model.js'

/**
 * 检查查验货物是否在敏感产品库中
 * @param {Array} items - 查验货物列表 [{hsCode, productName, material}]
 * @returns {Object} 检查结果
 */
export async function checkInspectionItemsAgainstSensitiveProducts(items) {
  if (!items || items.length === 0) {
    return { hasNewProducts: false, newItems: [], existingItems: [] }
  }

  const db = getDatabase()
  const newItems = []
  const existingItems = []

  for (const item of items) {
    if (!item.productName && !item.hsCode) continue

    // 检查品名是否存在
    let found = false
    let matchedProduct = null

    // 1. 按品名模糊匹配敏感产品库
    if (item.productName) {
      const productNameMatch = await db.prepare(`
        SELECT * FROM sensitive_products 
        WHERE is_active = true 
        AND (product_name ILIKE $1 OR $2 ILIKE '%' || product_name || '%')
        LIMIT 1
      `).get(`%${item.productName}%`, item.productName)
      
      if (productNameMatch) {
        found = true
        matchedProduct = productNameMatch
      }
    }

    // 2. 按HS编码匹配敏感产品库
    if (!found && item.hsCode) {
      const hsCodeMatch = await db.prepare(`
        SELECT * FROM sensitive_products 
        WHERE is_active = true 
        AND (
          hs_code = $1 
          OR $1 LIKE hs_code || '%'
          OR hs_code LIKE $1 || '%'
        )
        LIMIT 1
      `).get(item.hsCode.replace(/[^0-9]/g, ''))
      
      if (hsCodeMatch) {
        found = true
        matchedProduct = hsCodeMatch
      }
    }

    // 3. 按材质匹配（如果有材质字段）
    if (!found && item.material) {
      const materialMatch = await db.prepare(`
        SELECT * FROM sensitive_products 
        WHERE is_active = true 
        AND (product_name ILIKE $1 OR risk_notes ILIKE $1)
        LIMIT 1
      `).get(`%${item.material}%`)
      
      if (materialMatch) {
        found = true
        matchedProduct = materialMatch
      }
    }

    // 4. 同时检查查验产品库
    if (!found && item.hsCode) {
      const inspectionMatch = await db.prepare(`
        SELECT * FROM inspection_products 
        WHERE is_active = true 
        AND (
          hs_code = $1 
          OR $1 LIKE hs_code || '%'
          OR hs_code LIKE $1 || '%'
        )
        LIMIT 1
      `).get(item.hsCode.replace(/[^0-9]/g, ''))
      
      if (inspectionMatch) {
        found = true
        matchedProduct = { ...inspectionMatch, source: 'inspection_products' }
      }
    }

    if (!found && item.productName) {
      const inspectionNameMatch = await db.prepare(`
        SELECT * FROM inspection_products 
        WHERE is_active = true 
        AND (product_name ILIKE $1 OR $2 ILIKE '%' || product_name || '%')
        LIMIT 1
      `).get(`%${item.productName}%`, item.productName)
      
      if (inspectionNameMatch) {
        found = true
        matchedProduct = { ...inspectionNameMatch, source: 'inspection_products' }
      }
    }

    if (found) {
      existingItems.push({
        ...item,
        matchedProduct,
        source: matchedProduct.source || 'sensitive_products'
      })
    } else {
      newItems.push(item)
    }
  }

  return {
    hasNewProducts: newItems.length > 0,
    newItems,
    existingItems,
    summary: {
      total: items.length,
      existingCount: existingItems.length,
      newCount: newItems.length
    }
  }
}

/**
 * 创建敏感产品添加审批
 * @param {Object} data - 审批数据
 */
export async function createSensitiveProductAddApproval(data) {
  const {
    billId,
    billNumber,
    items,  // 要添加的产品列表
    applicantId,
    applicantName,
    applicantRole
  } = data

  const db = getDatabase()
  const now = new Date().toISOString()

  // 创建审批记录
  const approvalId = `approval-sp-${Date.now()}`
  
  await db.prepare(`
    INSERT INTO approvals (
      id, approval_type, business_id, title, content, 
      applicant_id, applicant_name, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `).run(
    approvalId,
    'sensitive_product_add',
    billId,
    `敏感产品库新增申请 - ${billNumber}`,
    JSON.stringify({
      billId,
      billNumber,
      items,
      reason: `查验货物中发现以下产品不在敏感产品库中，申请添加：${items.map(i => i.productName).join('、')}`
    }),
    applicantId,
    applicantName,
    'pending',
    now
  )

  // 发送消息通知给单证员审批（do, doc_officer）
  const documentOfficers = await db.prepare(`
    SELECT id, name, role FROM users 
    WHERE role IN ('do', 'doc_officer') 
    AND status = 'active'
  `).all()

  for (const officer of (documentOfficers || [])) {
    await messageModel.createMessage({
      type: 'approval',
      title: '敏感产品库新增审批待处理',
      content: `${applicantName} 申请将查验货物添加到敏感产品库，提单号：${billNumber}，共 ${items.length} 个产品，请审批。`,
      senderId: applicantId,
      senderName: applicantName,
      receiverId: officer.id,
      receiverName: officer.name,
      relatedType: 'approval',
      relatedId: approvalId
    })
  }

  // 同时通知 admin、boss、czjl（仅通知，无需审批）
  const managers = await db.prepare(`
    SELECT id, name, role FROM users 
    WHERE role IN ('admin', 'boss', 'czjl') 
    AND status = 'active'
  `).all()

  for (const manager of (managers || [])) {
    await messageModel.createMessage({
      type: 'system',
      title: '敏感产品库新增申请通知',
      content: `${applicantName} 申请将查验货物添加到敏感产品库，提单号：${billNumber}，共 ${items.length} 个产品（已通知单证员审批）`,
      senderId: applicantId,
      senderName: applicantName,
      receiverId: manager.id,
      receiverName: manager.name,
      relatedType: 'sensitive_product',
      relatedId: approvalId
    })
  }

  return { approvalId, success: true }
}

/**
 * 处理敏感产品添加审批
 * @param {string} approvalId - 审批ID
 * @param {Object} approverData - 审批人数据
 * @param {boolean} approved - 是否通过
 * @param {string} comment - 审批意见
 */
export async function processSensitiveProductAddApproval(approvalId, approverData, approved, comment) {
  const db = getDatabase()
  const now = new Date().toISOString()

  // 获取审批记录
  const approval = await db.prepare(`
    SELECT * FROM approvals WHERE id = $1
  `).get(approvalId)

  if (!approval) {
    throw new Error('审批记录不存在')
  }

  if (approval.status !== 'pending') {
    throw new Error('该审批已处理')
  }

  // 更新审批状态
  await db.prepare(`
    UPDATE approvals SET 
      status = $1,
      approver_id = $2,
      approver_name = $3,
      remark = $4,
      processed_at = $5,
      updated_at = $5
    WHERE id = $6
  `).run(
    approved ? 'approved' : 'rejected',
    approverData.id,
    approverData.name,
    comment || '',
    now,
    approvalId
  )

  // 解析审批内容
  const content = JSON.parse(approval.content || '{}')
  const items = content.items || []

  if (approved && items.length > 0) {
    // 审批通过，添加产品到敏感产品库
    for (const item of items) {
      await db.prepare(`
        INSERT INTO inspection_products (
          product_name, hs_code, duty_rate, inspection_rate,
          risk_level, risk_notes, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, $7)
      `).run(
        item.productName,
        item.hsCode || '',
        item.dutyRate || 0,
        100,  // 因为是查验发现的，设置查验率为100%
        'high',  // 默认高风险
        `来源：查验发现，提单号 ${content.billNumber}${item.material ? '，材质：' + item.material : ''}`,
        now
      )
    }
  }

  // 通知申请人
  await messageModel.createMessage({
    type: 'approval',
    title: `敏感产品添加审批${approved ? '通过' : '驳回'}`,
    content: `您提交的敏感产品库新增申请已${approved ? '通过' : '被驳回'}。${comment ? '意见：' + comment : ''}`,
    senderId: approverData.id,
    senderName: approverData.name,
    receiverId: approval.applicant_id,
    receiverName: approval.applicant_name,
    relatedType: 'approval',
    relatedId: approvalId
  })

  // 如果审批通过，通知 admin、boss、czjl
  if (approved) {
    const managers = await db.prepare(`
      SELECT id, name, role FROM users 
      WHERE role IN ('admin', 'boss', 'czjl') 
      AND status = 'active'
      AND id != $1
    `).all(approverData.id)

    for (const manager of (managers || [])) {
      await messageModel.createMessage({
        type: 'system',
        title: '敏感产品库已更新',
        content: `${approval.applicant_name} 申请的敏感产品已添加到产品库（审批人：${approverData.name}），共 ${items.length} 个产品（来源：提单 ${content.billNumber} 查验）`,
        senderId: approverData.id,
        senderName: approverData.name,
        receiverId: manager.id,
        receiverName: manager.name,
        relatedType: 'sensitive_product',
        relatedId: approvalId
      })
    }
  }

  return { success: true, approved, itemsAdded: approved ? items.length : 0 }
}

/**
 * 获取敏感产品添加审批列表
 */
export async function getSensitiveProductApprovals(params = {}) {
  const db = getDatabase()
  const { status, page = 1, pageSize = 20 } = params
  const offset = (page - 1) * pageSize

  let whereClause = "approval_type = 'sensitive_product_add'"
  const queryParams = []
  let paramIndex = 1

  if (status) {
    whereClause += ` AND status = $${paramIndex++}`
    queryParams.push(status)
  }

  const countResult = await db.prepare(`
    SELECT COUNT(*) as total FROM approvals WHERE ${whereClause}
  `).get(...queryParams)

  const list = await db.prepare(`
    SELECT * FROM approvals 
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `).all(...queryParams, pageSize, offset)

  return {
    list: (list || []).map(item => ({
      ...item,
      content: item.content ? JSON.parse(item.content) : {}
    })),
    total: countResult?.total || 0,
    page,
    pageSize
  }
}

export default {
  checkInspectionItemsAgainstSensitiveProducts,
  createSensitiveProductAddApproval,
  processSensitiveProductAddApproval,
  getSensitiveProductApprovals
}
