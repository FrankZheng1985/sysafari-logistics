/**
 * 文档管理模块 - 数据模型
 * 包含：文档管理、文件上传、文档分类、文档模板、版本管理
 */

import { getDatabase, generateId } from '../../config/database.js'
import fs from 'fs'
import path from 'path'

// ==================== 常量定义 ====================

export const DOCUMENT_TYPE = {
  BILL_OF_LADING: 'bill_of_lading',     // 提单
  INVOICE: 'invoice',                     // 发票
  PACKING_LIST: 'packing_list',          // 装箱单
  CUSTOMS_DECLARATION: 'customs_declaration', // 报关单
  CERTIFICATE: 'certificate',             // 证书
  CONTRACT: 'contract',                   // 合同
  INSURANCE: 'insurance',                 // 保险单
  DELIVERY_NOTE: 'delivery_note',         // 送货单
  INSPECTION_REPORT: 'inspection_report', // 查验报告
  OTHER: 'other'                          // 其他
}

export const DOCUMENT_STATUS = {
  DRAFT: 'draft',           // 草稿
  PENDING: 'pending',       // 待审核
  APPROVED: 'approved',     // 已审核
  REJECTED: 'rejected',     // 已拒绝
  ARCHIVED: 'archived'      // 已归档
}

export const ENTITY_TYPE = {
  BILL: 'bill',             // 提单
  CUSTOMER: 'customer',     // 客户
  INVOICE: 'invoice',       // 发票
  SHIPMENT: 'shipment'      // 货运
}

// 上传目录
const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

// ==================== 文档管理 ====================

/**
 * 获取文档列表
 */
export function getDocuments(params = {}) {
  const db = getDatabase()
  const { 
    type, status, entityType, entityId,
    uploadedBy, startDate, endDate, search,
    page = 1, pageSize = 20 
  } = params
  
  let query = 'SELECT * FROM documents WHERE 1=1'
  const queryParams = []
  
  if (type) {
    query += ' AND document_type = ?'
    queryParams.push(type)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (entityType) {
    query += ' AND entity_type = ?'
    queryParams.push(entityType)
  }
  
  if (entityId) {
    query += ' AND entity_id = ?'
    queryParams.push(entityId)
  }
  
  if (uploadedBy) {
    query += ' AND uploaded_by = ?'
    queryParams.push(uploadedBy)
  }
  
  if (startDate) {
    query += ' AND upload_time >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND upload_time <= ?'
    queryParams.push(endDate)
  }
  
  if (search) {
    query += ` AND (document_name LIKE ? OR original_name LIKE ? OR description LIKE ?)`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY upload_time DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertDocumentToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 获取文档统计
 */
export function getDocumentStats(params = {}) {
  const db = getDatabase()
  const { entityType, entityId } = params
  
  let whereClause = 'WHERE 1=1'
  const queryParams = []
  
  if (entityType) {
    whereClause += ' AND entity_type = ?'
    queryParams.push(entityType)
  }
  
  if (entityId) {
    whereClause += ' AND entity_id = ?'
    queryParams.push(entityId)
  }
  
  // 按文档类型统计
  const byType = db.prepare(`
    SELECT document_type, COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size
    FROM documents ${whereClause}
    GROUP BY document_type
  `).all(...queryParams)
  
  // 按状态统计
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM documents ${whereClause}
    GROUP BY status
  `).all(...queryParams)
  
  // 总计
  const total = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size
    FROM documents ${whereClause}
  `).get(...queryParams)
  
  return {
    total: {
      count: total.count || 0,
      totalSize: total.total_size || 0
    },
    byType: byType.map(t => ({
      type: t.document_type,
      count: t.count,
      totalSize: t.total_size
    })),
    byStatus: byStatus.map(s => ({
      status: s.status,
      count: s.count
    }))
  }
}

/**
 * 根据ID获取文档
 */
export function getDocumentById(id) {
  const db = getDatabase()
  const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id)
  return document ? convertDocumentToCamelCase(document) : null
}

/**
 * 创建文档记录
 */
export function createDocument(data) {
  const db = getDatabase()
  const id = generateId()
  
  const result = db.prepare(`
    INSERT INTO documents (
      id, document_name, original_name, document_type, file_path,
      file_size, mime_type, entity_type, entity_id, entity_number,
      description, tags, version, status,
      uploaded_by, uploaded_by_name, upload_time,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'), datetime('now', 'localtime'))
  `).run(
    id,
    data.documentName,
    data.originalName || data.documentName,
    data.documentType || 'other',
    data.filePath,
    data.fileSize || 0,
    data.mimeType || 'application/octet-stream',
    data.entityType || null,
    data.entityId || null,
    data.entityNumber || '',
    data.description || '',
    data.tags ? JSON.stringify(data.tags) : '[]',
    data.version || 1,
    data.status || 'approved',
    data.uploadedBy || null,
    data.uploadedByName || ''
  )
  
  return { id }
}

/**
 * 更新文档
 */
export function updateDocument(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    documentName: 'document_name',
    documentType: 'document_type',
    description: 'description',
    status: 'status'
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
  
  fields.push('updated_at = datetime("now", "localtime")')
  values.push(id)
  
  const result = db.prepare(`UPDATE documents SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除文档
 */
export function deleteDocument(id) {
  const db = getDatabase()
  
  // 获取文档信息以删除文件
  const doc = getDocumentById(id)
  
  // 删除数据库记录
  const result = db.prepare('DELETE FROM documents WHERE id = ?').run(id)
  
  // 尝试删除物理文件
  if (doc && doc.filePath) {
    try {
      const fullPath = path.join(UPLOAD_DIR, doc.filePath)
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
      }
    } catch (error) {
      console.error('删除文件失败:', error.message)
    }
  }
  
  return result.changes > 0
}

/**
 * 更新文档状态
 */
export function updateDocumentStatus(id, status, reviewNote = '') {
  const db = getDatabase()
  const result = db.prepare(`
    UPDATE documents 
    SET status = ?, review_note = ?, review_time = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(status, reviewNote, id)
  return result.changes > 0
}

// ==================== 实体文档关联 ====================

/**
 * 获取实体关联的文档
 */
export function getEntityDocuments(entityType, entityId) {
  const db = getDatabase()
  const documents = db.prepare(`
    SELECT * FROM documents 
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY document_type, upload_time DESC
  `).all(entityType, entityId)
  
  return documents.map(convertDocumentToCamelCase)
}

/**
 * 关联文档到实体
 */
export function linkDocumentToEntity(documentId, entityType, entityId, entityNumber = '') {
  const db = getDatabase()
  const result = db.prepare(`
    UPDATE documents 
    SET entity_type = ?, entity_id = ?, entity_number = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(entityType, entityId, entityNumber, documentId)
  return result.changes > 0
}

/**
 * 解除文档与实体的关联
 */
export function unlinkDocumentFromEntity(documentId) {
  const db = getDatabase()
  const result = db.prepare(`
    UPDATE documents 
    SET entity_type = NULL, entity_id = NULL, entity_number = '', updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(documentId)
  return result.changes > 0
}

// ==================== 文档模板 ====================

/**
 * 获取文档模板列表
 */
export function getTemplates(params = {}) {
  const db = getDatabase()
  const { type, status = 'active', search, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM document_templates WHERE 1=1'
  const queryParams = []
  
  if (type) {
    query += ' AND template_type = ?'
    queryParams.push(type)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (search) {
    query += ` AND (template_name LIKE ? OR description LIKE ?)`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY sort_order, template_name LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertTemplateToCamelCase),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 根据ID获取模板
 */
export function getTemplateById(id) {
  const db = getDatabase()
  const template = db.prepare('SELECT * FROM document_templates WHERE id = ?').get(id)
  return template ? convertTemplateToCamelCase(template) : null
}

/**
 * 创建文档模板
 */
export function createTemplate(data) {
  const db = getDatabase()
  const id = generateId()
  
  const result = db.prepare(`
    INSERT INTO document_templates (
      id, template_name, template_type, file_path, file_name,
      description, variables, sort_order, status,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `).run(
    id,
    data.templateName,
    data.templateType || 'other',
    data.filePath || '',
    data.fileName || '',
    data.description || '',
    data.variables ? JSON.stringify(data.variables) : '[]',
    data.sortOrder || 0,
    data.status || 'active',
    data.createdBy || null
  )
  
  return { id }
}

/**
 * 更新文档模板
 */
export function updateTemplate(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    templateName: 'template_name',
    templateType: 'template_type',
    filePath: 'file_path',
    fileName: 'file_name',
    description: 'description',
    sortOrder: 'sort_order',
    status: 'status'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  // 特殊处理variables
  if (data.variables !== undefined) {
    fields.push('variables = ?')
    values.push(JSON.stringify(data.variables))
  }
  
  if (fields.length === 0) return false
  
  fields.push('updated_at = datetime("now", "localtime")')
  values.push(id)
  
  const result = db.prepare(`UPDATE document_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除文档模板
 */
export function deleteTemplate(id) {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM document_templates WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 文档版本管理 ====================

/**
 * 获取文档版本历史
 */
export function getDocumentVersions(documentId) {
  const db = getDatabase()
  const versions = db.prepare(`
    SELECT * FROM document_versions 
    WHERE document_id = ?
    ORDER BY version DESC
  `).all(documentId)
  
  return versions.map(v => ({
    id: v.id,
    documentId: v.document_id,
    version: v.version,
    filePath: v.file_path,
    fileSize: v.file_size,
    changeNote: v.change_note,
    uploadedBy: v.uploaded_by,
    uploadedByName: v.uploaded_by_name,
    uploadTime: v.upload_time
  }))
}

/**
 * 创建新版本
 */
export function createDocumentVersion(data) {
  const db = getDatabase()
  const id = generateId()
  
  // 获取当前最高版本
  const latest = db.prepare(`
    SELECT MAX(version) as max_version FROM document_versions WHERE document_id = ?
  `).get(data.documentId)
  
  const newVersion = (latest?.max_version || 0) + 1
  
  db.prepare(`
    INSERT INTO document_versions (
      id, document_id, version, file_path, file_size,
      change_note, uploaded_by, uploaded_by_name, upload_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `).run(
    id,
    data.documentId,
    newVersion,
    data.filePath,
    data.fileSize || 0,
    data.changeNote || '',
    data.uploadedBy || null,
    data.uploadedByName || ''
  )
  
  // 更新主文档版本号和文件路径
  db.prepare(`
    UPDATE documents 
    SET version = ?, file_path = ?, file_size = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(newVersion, data.filePath, data.fileSize || 0, data.documentId)
  
  return { id, version: newVersion }
}

// ==================== 文件操作辅助函数 ====================

/**
 * 确保上传目录存在
 */
export function ensureUploadDir(subDir = '') {
  const targetDir = subDir ? path.join(UPLOAD_DIR, subDir) : UPLOAD_DIR
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }
  return targetDir
}

/**
 * 生成唯一文件名
 */
export function generateUniqueFileName(originalName) {
  const ext = path.extname(originalName)
  const baseName = path.basename(originalName, ext)
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${baseName}_${timestamp}_${random}${ext}`
}

/**
 * 获取文件路径
 */
export function getFilePath(relativePath) {
  return path.join(UPLOAD_DIR, relativePath)
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// ==================== 数据转换函数 ====================

export function convertDocumentToCamelCase(row) {
  let tags = []
  if (row.tags) {
    try {
      tags = JSON.parse(row.tags)
    } catch (e) {
      tags = []
    }
  }
  
  return {
    id: row.id,
    documentName: row.document_name,
    originalName: row.original_name,
    documentType: row.document_type,
    filePath: row.file_path,
    fileSize: row.file_size,
    fileSizeFormatted: formatFileSize(row.file_size),
    mimeType: row.mime_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityNumber: row.entity_number,
    description: row.description,
    tags,
    version: row.version,
    status: row.status,
    reviewNote: row.review_note,
    reviewTime: row.review_time,
    uploadedBy: row.uploaded_by,
    uploadedByName: row.uploaded_by_name,
    uploadTime: row.upload_time,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export function convertTemplateToCamelCase(row) {
  let variables = []
  if (row.variables) {
    try {
      variables = JSON.parse(row.variables)
    } catch (e) {
      variables = []
    }
  }
  
  return {
    id: row.id,
    templateName: row.template_name,
    templateType: row.template_type,
    filePath: row.file_path,
    fileName: row.file_name,
    description: row.description,
    variables,
    sortOrder: row.sort_order,
    status: row.status,
    createdBy: row.created_by,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export default {
  // 常量
  DOCUMENT_TYPE,
  DOCUMENT_STATUS,
  ENTITY_TYPE,
  
  // 文档管理
  getDocuments,
  getDocumentStats,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  updateDocumentStatus,
  
  // 实体关联
  getEntityDocuments,
  linkDocumentToEntity,
  unlinkDocumentFromEntity,
  
  // 文档模板
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  
  // 版本管理
  getDocumentVersions,
  createDocumentVersion,
  
  // 文件操作
  ensureUploadDir,
  generateUniqueFileName,
  getFilePath,
  formatFileSize,
  
  // 转换函数
  convertDocumentToCamelCase,
  convertTemplateToCamelCase
}

