/**
 * 文档管理模块 - 数据模型
 * 支持腾讯云COS存储、订单关联、权限控制
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== 常量定义 ====================

export const DOCUMENT_TYPE = {
  BILL_OF_LADING: 'bill_of_lading',           // 提单
  INVOICE: 'invoice',                          // 发票
  PACKING_LIST: 'packing_list',               // 装箱单
  CUSTOMS_DECLARATION: 'customs_declaration', // 报关单
  CONTRACT: 'contract',                        // 合同
  CERTIFICATE: 'certificate',                  // 证书
  INSURANCE: 'insurance',                      // 保险单
  DELIVERY_NOTE: 'delivery_note',             // 送货单/CMR
  INSPECTION_REPORT: 'inspection_report',     // 查验报告
  QUOTATION: 'quotation',                      // 报价单
  PAYMENT_RECEIPT: 'payment_receipt',         // 付款凭证
  OTHER: 'other'                               // 其他
}

export const DOCUMENT_TYPE_LABELS = {
  bill_of_lading: '提单',
  invoice: '发票',
  packing_list: '装箱单',
  customs_declaration: '报关单',
  contract: '合同',
  certificate: '证书',
  insurance: '保险单',
  delivery_note: '送货单/CMR',
  inspection_report: '查验报告',
  quotation: '报价单',
  payment_receipt: '付款凭证',
  other: '其他'
}

export const DOCUMENT_STATUS = {
  ACTIVE: 'active',       // 正常
  ARCHIVED: 'archived',   // 已归档
  DELETED: 'deleted'      // 已删除
}

export const ACCESS_LEVEL = {
  ORDER_RELATED: 'order_related',  // 订单相关人员可见
  FINANCE: 'finance',               // 财务可见
  ADMIN: 'admin'                    // 仅管理员可见
}

// 财务相关文档类型
export const FINANCE_DOCUMENT_TYPES = ['invoice', 'contract', 'payment_receipt', 'quotation']

// ==================== 文档管理 ====================

/**
 * 获取文档列表
 */
export async function getDocuments(params = {}) {
  const db = getDatabase()
  const { 
    billId,
    billNumber,
    customerId,
    documentType,
    status = 'active',
    accessLevel,
    uploadedBy,
    startDate,
    endDate,
    search,
    page = 1,
    pageSize = 20,
    // 权限过滤参数
    userRole,
    userId
  } = params
  
  // 使用 LEFT JOIN 获取订单的 order_seq 以生成订单号
  let query = `SELECT d.*, b.order_seq, b.created_at as bill_created_at 
    FROM documents d 
    LEFT JOIN bills_of_lading b ON d.bill_id = b.id 
    WHERE 1=1`
  const queryParams = []
  
  // 状态过滤
  if (status) {
    query += ' AND d.status = ?'
    queryParams.push(status)
  }
  
  // 订单关联过滤
  if (billId) {
    query += ' AND d.bill_id = ?'
    queryParams.push(billId)
  }
  
  if (billNumber) {
    query += ' AND d.bill_number = ?'
    queryParams.push(billNumber)
  }
  
  // 客户过滤
  if (customerId) {
    query += ' AND d.customer_id = ?'
    queryParams.push(customerId)
  }
  
  // 文档类型过滤
  if (documentType) {
    query += ' AND d.document_type = ?'
    queryParams.push(documentType)
  }
  
  // 访问级别过滤
  if (accessLevel) {
    query += ' AND d.access_level = ?'
    queryParams.push(accessLevel)
  }
  
  // 上传人过滤
  if (uploadedBy) {
    query += ' AND d.uploaded_by = ?'
    queryParams.push(uploadedBy)
  }
  
  // 日期范围过滤
  if (startDate) {
    query += ' AND d.upload_time >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND d.upload_time <= ?'
    queryParams.push(endDate)
  }
  
  // 搜索
  if (search) {
    query += ` AND (
      d.document_name LIKE ? OR 
      d.original_name LIKE ? OR 
      d.bill_number LIKE ? OR
      d.description LIKE ?
    )`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern)
  }
  
  // 权限过滤
  if (userRole && userRole !== 'admin') {
    // 非管理员只能看到：
    // 1. 自己上传的文档
    // 2. 公开的文档 (is_public = true)
    // 3. 财务角色可以看到财务相关文档
    if (userRole === 'finance') {
      query += ` AND (
        d.is_public = true OR 
        d.uploaded_by = ? OR 
        d.access_level = 'finance' OR
        d.document_type IN (${FINANCE_DOCUMENT_TYPES.map(() => '?').join(',')})
      )`
      queryParams.push(userId, ...FINANCE_DOCUMENT_TYPES)
    } else {
      query += ' AND (d.is_public = true OR d.uploaded_by = ?)'
      queryParams.push(userId)
    }
  }
  
  // 获取总数
  const countQuery = query.replace(/SELECT d\.\*, b\.order_seq, b\.created_at as bill_created_at/, 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY d.upload_time DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertDocumentToCamelCase),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 获取订单关联的文档列表
 */
export async function getOrderDocuments(billId, params = {}) {
  return getDocuments({
    billId,
    status: 'active',
    ...params
  })
}

/**
 * 按文档类型分组获取订单文档
 */
export async function getOrderDocumentsGrouped(billId) {
  const db = getDatabase()
  
  const documents = await db.prepare(`
    SELECT * FROM documents 
    WHERE bill_id = ? AND status = 'active'
    ORDER BY document_type, upload_time DESC
  `).all(billId)
  
  // 按类型分组
  const grouped = {}
  documents.forEach(doc => {
    const type = doc.document_type || 'other'
    if (!grouped[type]) {
      grouped[type] = {
        type,
        label: DOCUMENT_TYPE_LABELS[type] || '其他',
        documents: []
      }
    }
    grouped[type].documents.push(convertDocumentToCamelCase(doc))
  })
  
  return Object.values(grouped)
}

/**
 * 获取文档统计
 */
export async function getDocumentStats(params = {}) {
  const db = getDatabase()
  const { billId, customerId } = params
  
  let whereClause = "WHERE status = 'active'"
  const queryParams = []
  
  if (billId) {
    whereClause += ' AND bill_id = ?'
    queryParams.push(billId)
  }
  
  if (customerId) {
    whereClause += ' AND customer_id = ?'
    queryParams.push(customerId)
  }
  
  // 按文档类型统计
  const byType = await db.prepare(`
    SELECT document_type, COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size
    FROM documents ${whereClause}
    GROUP BY document_type
  `).all(...queryParams)
  
  // 总计
  const total = await db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size
    FROM documents ${whereClause}
  `).get(...queryParams)
  
  return {
    total: {
      count: total?.count || 0,
      totalSize: total?.total_size || 0
    },
    byType: byType.map(t => ({
      type: t.document_type,
      label: DOCUMENT_TYPE_LABELS[t.document_type] || '其他',
      count: t.count,
      totalSize: t.total_size
    }))
  }
}

/**
 * 根据ID获取文档
 */
export async function getDocumentById(id) {
  const db = getDatabase()
  const document = await db.prepare('SELECT * FROM documents WHERE id = ?').get(id)
  return document ? convertDocumentToCamelCase(document) : null
}

/**
 * 根据COS Key获取文档
 */
export async function getDocumentByCosKey(cosKey) {
  const db = getDatabase()
  const document = await db.prepare('SELECT * FROM documents WHERE cos_key = ?').get(cosKey)
  return document ? convertDocumentToCamelCase(document) : null
}

/**
 * 创建文档记录
 */
export async function createDocument(data) {
  const db = getDatabase()
  const id = generateId()
  const documentNumber = `DOC${Date.now()}`
  const now = new Date().toISOString()
  
  const result = await db.prepare(`
    INSERT INTO documents (
      id, document_number, document_name, original_name, document_type,
      bill_id, bill_number, customer_id, customer_name,
      cos_key, cos_url, cos_bucket, cos_region,
      file_size, mime_type, file_extension,
      access_level, is_public, description, tags, remark,
      version, is_latest, parent_id,
      uploaded_by, uploaded_by_name, upload_time,
      status, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?
    )
  `).run(
    id,
    documentNumber,
    data.documentName || data.originalName,
    data.originalName,
    data.documentType || 'other',
    data.billId || null,
    data.billNumber || null,
    data.customerId || null,
    data.customerName || null,
    data.cosKey,
    data.cosUrl,
    data.cosBucket || null,
    data.cosRegion || null,
    data.fileSize || 0,
    data.mimeType || 'application/octet-stream',
    data.fileExtension || null,
    data.accessLevel || 'order_related',
    data.isPublic !== false,
    data.description || null,
    data.tags ? JSON.stringify(data.tags) : '[]',
    data.remark || null,
    data.version || 1,
    data.isLatest !== false,
    data.parentId || null,
    data.uploadedBy || null,
    data.uploadedByName || null,
    now,
    'active',
    now,
    now
  )
  
  return { id, documentNumber }
}

/**
 * 更新文档信息
 */
export async function updateDocument(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    documentName: 'document_name',
    documentType: 'document_type',
    description: 'description',
    remark: 'remark',
    accessLevel: 'access_level',
    isPublic: 'is_public',
    status: 'status',
    // 订单关联
    billId: 'bill_id',
    billNumber: 'bill_number',
    customerId: 'customer_id',
    customerName: 'customer_name'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  // 特殊处理tags
  if (data.tags !== undefined) {
    fields.push('tags = ?')
    values.push(JSON.stringify(data.tags))
  }
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = ?")
  values.push(new Date().toISOString())
  values.push(id)
  
  const result = await db.prepare(`UPDATE documents SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除文档（软删除）
 */
export async function deleteDocument(id) {
  const db = getDatabase()
  const now = new Date().toISOString()
  const result = await db.prepare(`
    UPDATE documents SET status = 'deleted', updated_at = ? WHERE id = ?
  `).run(now, id)
  return result.changes > 0
}

/**
 * 硬删除文档
 */
export async function hardDeleteDocument(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM documents WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 批量删除文档
 */
export async function deleteDocuments(ids) {
  const db = getDatabase()
  const now = new Date().toISOString()
  const placeholders = ids.map(() => '?').join(',')
  const result = await db.prepare(`
    UPDATE documents SET status = 'deleted', updated_at = ? WHERE id IN (${placeholders})
  `).run(now, ...ids)
  return result.changes
}

/**
 * 关联文档到订单
 */
export async function linkDocumentToOrder(documentId, billId, billNumber) {
  const db = getDatabase()
  const now = new Date().toISOString()
  const result = await db.prepare(`
    UPDATE documents 
    SET bill_id = ?, bill_number = ?, updated_at = ?
    WHERE id = ?
  `).run(billId, billNumber, now, documentId)
  return result.changes > 0
}

/**
 * 解除文档与订单的关联
 */
export async function unlinkDocumentFromOrder(documentId) {
  const db = getDatabase()
  const now = new Date().toISOString()
  const result = await db.prepare(`
    UPDATE documents 
    SET bill_id = NULL, bill_number = NULL, updated_at = ?
    WHERE id = ?
  `).run(now, documentId)
  return result.changes > 0
}

// ==================== 文档版本管理 ====================

/**
 * 获取文档版本历史
 */
export async function getDocumentVersions(documentId) {
  const db = getDatabase()
  const versions = await db.prepare(`
    SELECT * FROM document_versions 
    WHERE document_id = ?
    ORDER BY version DESC
  `).all(documentId)
  
  return versions.map(v => ({
    id: v.id,
    documentId: v.document_id,
    version: v.version,
    cosKey: v.cos_key,
    cosUrl: v.cos_url,
    fileSize: v.file_size,
    changeNote: v.change_note,
    uploadedBy: v.uploaded_by,
    uploadedByName: v.uploaded_by_name,
    uploadTime: v.upload_time,
    createdAt: v.created_at
  }))
}

/**
 * 创建新版本
 */
export async function createDocumentVersion(data) {
  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()
  
  // 获取当前最高版本
  const latest = await db.prepare(`
    SELECT MAX(version) as max_version FROM document_versions WHERE document_id = ?
  `).get(data.documentId)
  
  const newVersion = (latest?.max_version || 0) + 1
  
  // 创建版本记录
  await db.prepare(`
    INSERT INTO document_versions (
      id, document_id, version, cos_key, cos_url, file_size,
      change_note, uploaded_by, uploaded_by_name, upload_time, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.documentId,
    newVersion,
    data.cosKey,
    data.cosUrl,
    data.fileSize || 0,
    data.changeNote || '',
    data.uploadedBy || null,
    data.uploadedByName || '',
    now,
    now
  )
  
  // 更新主文档
  await db.prepare(`
    UPDATE documents 
    SET version = ?, cos_key = ?, cos_url = ?, file_size = ?, updated_at = ?
    WHERE id = ?
  `).run(newVersion, data.cosKey, data.cosUrl, data.fileSize || 0, now, data.documentId)
  
  return { id, version: newVersion }
}

// ==================== 权限检查 ====================

/**
 * 检查用户是否有权访问文档
 */
export async function checkDocumentAccess(documentId, userId, userRole) {
  const document = await getDocumentById(documentId)
  
  if (!document) {
    return { hasAccess: false, reason: '文档不存在' }
  }
  
  // 管理员可以访问所有文档
  if (userRole === 'admin') {
    return { hasAccess: true }
  }
  
  // 上传者可以访问自己的文档
  if (document.uploadedBy === userId) {
    return { hasAccess: true }
  }
  
  // 公开文档所有人可以访问
  if (document.isPublic) {
    return { hasAccess: true }
  }
  
  // 财务角色可以访问财务相关文档
  if (userRole === 'finance' && FINANCE_DOCUMENT_TYPES.includes(document.documentType)) {
    return { hasAccess: true }
  }
  
  // 财务角色可以访问财务级别的文档
  if (userRole === 'finance' && document.accessLevel === 'finance') {
    return { hasAccess: true }
  }
  
  return { hasAccess: false, reason: '无权访问此文档' }
}

// ==================== 数据转换函数 ====================

export function convertDocumentToCamelCase(row) {
  if (!row) return null
  
  let tags = []
  if (row.tags) {
    try {
      tags = JSON.parse(row.tags)
    } catch (e) {
      tags = []
    }
  }
  
  // 根据 order_seq 生成订单号
  let orderNumber = null
  if (row.order_seq) {
    const createDate = row.bill_created_at ? new Date(row.bill_created_at) : new Date()
    const year = createDate.getFullYear().toString().slice(-2)
    orderNumber = `BP${year}${String(row.order_seq).padStart(5, '0')}`
  }
  
  return {
    id: row.id,
    documentNumber: row.document_number,
    documentName: row.document_name,
    originalName: row.original_name,
    documentType: row.document_type,
    documentTypeLabel: DOCUMENT_TYPE_LABELS[row.document_type] || '其他',
    // 订单关联
    billId: row.bill_id,
    billNumber: row.bill_number,
    orderNumber,  // 订单号
    customerId: row.customer_id,
    customerName: row.customer_name,
    // COS存储信息
    cosKey: row.cos_key,
    cosUrl: row.cos_url,
    cosBucket: row.cos_bucket,
    cosRegion: row.cos_region,
    // 文件信息
    fileSize: row.file_size,
    fileSizeFormatted: formatFileSize(row.file_size),
    mimeType: row.mime_type,
    fileExtension: row.file_extension,
    // 权限
    accessLevel: row.access_level,
    isPublic: row.is_public === true || row.is_public === 1,
    // 描述和标签
    description: row.description,
    tags,
    remark: row.remark,
    // 版本
    version: row.version,
    isLatest: row.is_latest === true || row.is_latest === 1,
    parentId: row.parent_id,
    // 上传信息
    uploadedBy: row.uploaded_by,
    uploadedByName: row.uploaded_by_name,
    uploadTime: row.upload_time,
    // 状态
    status: row.status,
    // 时间戳
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// ==================== 导出 ====================

export default {
  // 常量
  DOCUMENT_TYPE,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS,
  ACCESS_LEVEL,
  FINANCE_DOCUMENT_TYPES,
  
  // 文档管理
  getDocuments,
  getOrderDocuments,
  getOrderDocumentsGrouped,
  getDocumentStats,
  getDocumentById,
  getDocumentByCosKey,
  createDocument,
  updateDocument,
  deleteDocument,
  hardDeleteDocument,
  deleteDocuments,
  
  // 订单关联
  linkDocumentToOrder,
  unlinkDocumentFromOrder,
  
  // 版本管理
  getDocumentVersions,
  createDocumentVersion,
  
  // 权限检查
  checkDocumentAccess,
  
  // 工具函数
  convertDocumentToCamelCase,
  formatFileSize
}
