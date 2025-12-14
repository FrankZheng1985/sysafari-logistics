/**
 * 文档管理模块 - 控制器
 */

import { success, successWithPagination, badRequest, notFound, serverError } from '../../utils/response.js'
import * as model from './model.js'
import path from 'path'
import fs from 'fs'

// ==================== 文档管理 ====================

/**
 * 获取文档列表
 */
export async function getDocuments(req, res) {
  try {
    const { type, status, entityType, entityId, uploadedBy, startDate, endDate, search, page, pageSize } = req.query
    
    const result = model.getDocuments({
      type,
      status,
      entityType,
      entityId,
      uploadedBy: uploadedBy ? parseInt(uploadedBy) : undefined,
      startDate,
      endDate,
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取文档列表失败:', error)
    return serverError(res, '获取文档列表失败')
  }
}

/**
 * 获取文档统计
 */
export async function getDocumentStats(req, res) {
  try {
    const { entityType, entityId } = req.query
    const stats = model.getDocumentStats({ entityType, entityId })
    return success(res, stats)
  } catch (error) {
    console.error('获取文档统计失败:', error)
    return serverError(res, '获取文档统计失败')
  }
}

/**
 * 获取文档详情
 */
export async function getDocumentById(req, res) {
  try {
    const document = model.getDocumentById(req.params.id)
    if (!document) {
      return notFound(res, '文档不存在')
    }
    
    // 获取版本历史
    const versions = model.getDocumentVersions(document.id)
    
    return success(res, {
      ...document,
      versions
    })
  } catch (error) {
    console.error('获取文档详情失败:', error)
    return serverError(res, '获取文档详情失败')
  }
}

/**
 * 创建文档（上传文件）
 */
export async function createDocument(req, res) {
  try {
    const { documentName, documentType, entityType, entityId, entityNumber, description, tags } = req.body
    
    if (!documentName) {
      return badRequest(res, '文档名称为必填项')
    }
    
    // 如果有文件上传，处理文件
    let filePath = ''
    let fileSize = 0
    let mimeType = 'application/octet-stream'
    let originalName = documentName
    
    if (req.file) {
      // 确保上传目录存在
      const uploadDir = model.ensureUploadDir(entityType || 'general')
      
      // 生成唯一文件名
      const uniqueName = model.generateUniqueFileName(req.file.originalname)
      filePath = path.join(entityType || 'general', uniqueName)
      fileSize = req.file.size
      mimeType = req.file.mimetype
      originalName = req.file.originalname
      
      // 移动文件到目标位置（如果使用multer diskStorage，文件已经在目标位置）
    }
    
    const result = model.createDocument({
      documentName,
      originalName,
      documentType: documentType || 'other',
      filePath,
      fileSize,
      mimeType,
      entityType,
      entityId,
      entityNumber,
      description,
      tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
      uploadedBy: req.user?.id,
      uploadedByName: req.user?.name || ''
    })
    
    const newDocument = model.getDocumentById(result.id)
    return success(res, newDocument, '上传成功')
  } catch (error) {
    console.error('创建文档失败:', error)
    return serverError(res, '创建文档失败')
  }
}

/**
 * 更新文档信息
 */
export async function updateDocument(req, res) {
  try {
    const { id } = req.params
    
    const existing = model.getDocumentById(id)
    if (!existing) {
      return notFound(res, '文档不存在')
    }
    
    const updated = model.updateDocument(id, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedDocument = model.getDocumentById(id)
    return success(res, updatedDocument, '更新成功')
  } catch (error) {
    console.error('更新文档失败:', error)
    return serverError(res, '更新文档失败')
  }
}

/**
 * 删除文档
 */
export async function deleteDocument(req, res) {
  try {
    const { id } = req.params
    
    const existing = model.getDocumentById(id)
    if (!existing) {
      return notFound(res, '文档不存在')
    }
    
    model.deleteDocument(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除文档失败:', error)
    return serverError(res, '删除文档失败')
  }
}

/**
 * 更新文档状态（审核）
 */
export async function updateDocumentStatus(req, res) {
  try {
    const { id } = req.params
    const { status, reviewNote } = req.body
    
    if (!status || !['draft', 'pending', 'approved', 'rejected', 'archived'].includes(status)) {
      return badRequest(res, '状态值无效')
    }
    
    const existing = model.getDocumentById(id)
    if (!existing) {
      return notFound(res, '文档不存在')
    }
    
    model.updateDocumentStatus(id, status, reviewNote)
    const updatedDocument = model.getDocumentById(id)
    
    return success(res, updatedDocument, '状态更新成功')
  } catch (error) {
    console.error('更新文档状态失败:', error)
    return serverError(res, '更新文档状态失败')
  }
}

/**
 * 下载文档
 */
export async function downloadDocument(req, res) {
  try {
    const { id } = req.params
    
    const document = model.getDocumentById(id)
    if (!document) {
      return notFound(res, '文档不存在')
    }
    
    if (!document.filePath) {
      return badRequest(res, '文档文件不存在')
    }
    
    const filePath = model.getFilePath(document.filePath)
    
    if (!fs.existsSync(filePath)) {
      return notFound(res, '文件不存在')
    }
    
    // 设置下载头
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.originalName)}"`)
    res.setHeader('Content-Type', document.mimeType)
    
    // 发送文件
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)
  } catch (error) {
    console.error('下载文档失败:', error)
    return serverError(res, '下载文档失败')
  }
}

// ==================== 实体文档 ====================

/**
 * 获取实体关联的文档
 */
export async function getEntityDocuments(req, res) {
  try {
    const { entityType, entityId } = req.params
    
    const documents = model.getEntityDocuments(entityType, entityId)
    return success(res, documents)
  } catch (error) {
    console.error('获取实体文档失败:', error)
    return serverError(res, '获取实体文档失败')
  }
}

/**
 * 关联文档到实体
 */
export async function linkDocumentToEntity(req, res) {
  try {
    const { id } = req.params
    const { entityType, entityId, entityNumber } = req.body
    
    if (!entityType || !entityId) {
      return badRequest(res, '实体类型和实体ID为必填项')
    }
    
    const document = model.getDocumentById(id)
    if (!document) {
      return notFound(res, '文档不存在')
    }
    
    model.linkDocumentToEntity(id, entityType, entityId, entityNumber)
    const updatedDocument = model.getDocumentById(id)
    
    return success(res, updatedDocument, '关联成功')
  } catch (error) {
    console.error('关联文档失败:', error)
    return serverError(res, '关联文档失败')
  }
}

/**
 * 解除文档关联
 */
export async function unlinkDocumentFromEntity(req, res) {
  try {
    const { id } = req.params
    
    const document = model.getDocumentById(id)
    if (!document) {
      return notFound(res, '文档不存在')
    }
    
    model.unlinkDocumentFromEntity(id)
    const updatedDocument = model.getDocumentById(id)
    
    return success(res, updatedDocument, '解除关联成功')
  } catch (error) {
    console.error('解除文档关联失败:', error)
    return serverError(res, '解除文档关联失败')
  }
}

// ==================== 文档模板 ====================

/**
 * 获取文档模板列表
 */
export async function getTemplates(req, res) {
  try {
    const { type, status, search, page, pageSize } = req.query
    
    const result = model.getTemplates({
      type,
      status,
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取模板列表失败:', error)
    return serverError(res, '获取模板列表失败')
  }
}

/**
 * 获取模板详情
 */
export async function getTemplateById(req, res) {
  try {
    const template = model.getTemplateById(req.params.id)
    if (!template) {
      return notFound(res, '模板不存在')
    }
    return success(res, template)
  } catch (error) {
    console.error('获取模板详情失败:', error)
    return serverError(res, '获取模板详情失败')
  }
}

/**
 * 创建文档模板
 */
export async function createTemplate(req, res) {
  try {
    const { templateName, templateType } = req.body
    
    if (!templateName) {
      return badRequest(res, '模板名称为必填项')
    }
    
    const result = model.createTemplate({
      ...req.body,
      createdBy: req.user?.id
    })
    
    const newTemplate = model.getTemplateById(result.id)
    return success(res, newTemplate, '创建成功')
  } catch (error) {
    console.error('创建模板失败:', error)
    return serverError(res, '创建模板失败')
  }
}

/**
 * 更新文档模板
 */
export async function updateTemplate(req, res) {
  try {
    const { id } = req.params
    
    const existing = model.getTemplateById(id)
    if (!existing) {
      return notFound(res, '模板不存在')
    }
    
    const updated = model.updateTemplate(id, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedTemplate = model.getTemplateById(id)
    return success(res, updatedTemplate, '更新成功')
  } catch (error) {
    console.error('更新模板失败:', error)
    return serverError(res, '更新模板失败')
  }
}

/**
 * 删除文档模板
 */
export async function deleteTemplate(req, res) {
  try {
    const { id } = req.params
    
    const existing = model.getTemplateById(id)
    if (!existing) {
      return notFound(res, '模板不存在')
    }
    
    model.deleteTemplate(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除模板失败:', error)
    return serverError(res, '删除模板失败')
  }
}

// ==================== 版本管理 ====================

/**
 * 获取文档版本历史
 */
export async function getDocumentVersions(req, res) {
  try {
    const { id } = req.params
    
    const document = model.getDocumentById(id)
    if (!document) {
      return notFound(res, '文档不存在')
    }
    
    const versions = model.getDocumentVersions(id)
    return success(res, versions)
  } catch (error) {
    console.error('获取版本历史失败:', error)
    return serverError(res, '获取版本历史失败')
  }
}

/**
 * 上传新版本
 */
export async function createDocumentVersion(req, res) {
  try {
    const { id } = req.params
    const { changeNote } = req.body
    
    const document = model.getDocumentById(id)
    if (!document) {
      return notFound(res, '文档不存在')
    }
    
    // 处理上传的文件
    if (!req.file) {
      return badRequest(res, '请上传文件')
    }
    
    const uploadDir = model.ensureUploadDir(document.entityType || 'general')
    const uniqueName = model.generateUniqueFileName(req.file.originalname)
    const filePath = path.join(document.entityType || 'general', uniqueName)
    
    const result = model.createDocumentVersion({
      documentId: id,
      filePath,
      fileSize: req.file.size,
      changeNote,
      uploadedBy: req.user?.id,
      uploadedByName: req.user?.name || ''
    })
    
    const updatedDocument = model.getDocumentById(id)
    return success(res, {
      document: updatedDocument,
      version: result.version
    }, '新版本上传成功')
  } catch (error) {
    console.error('上传新版本失败:', error)
    return serverError(res, '上传新版本失败')
  }
}

