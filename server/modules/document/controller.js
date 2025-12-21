/**
 * 文档管理模块 - 控制器
 * 支持腾讯云COS存储、订单关联、权限控制
 */

import { success, successWithPagination, badRequest, notFound, serverError, forbidden } from '../../utils/response.js'
import * as model from './model.js'
import * as cosService from '../../utils/cosService.js'
import path from 'path'

// ==================== 文档管理 ====================

/**
 * 获取文档列表
 */
export async function getDocuments(req, res) {
  try {
    const { 
      billId, billNumber, customerId, documentType, status,
      accessLevel, uploadedBy, startDate, endDate, search, 
      page, pageSize 
    } = req.query
    
    const result = await model.getDocuments({
      billId,
      billNumber,
      customerId,
      documentType,
      status,
      accessLevel,
      uploadedBy,
      startDate,
      endDate,
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      // 权限过滤
      userRole: req.user?.role,
      userId: req.user?.id
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
 * 获取订单关联的文档列表
 */
export async function getOrderDocuments(req, res) {
  try {
    const { billId } = req.params
    const { grouped } = req.query
    
    if (!billId) {
      return badRequest(res, '订单ID为必填项')
    }
    
    if (grouped === 'true') {
      const result = await model.getOrderDocumentsGrouped(billId)
      return success(res, result)
    }
    
    const result = await model.getOrderDocuments(billId, {
      userRole: req.user?.role,
      userId: req.user?.id
    })
    
    return success(res, result.list)
  } catch (error) {
    console.error('获取订单文档失败:', error)
    return serverError(res, '获取订单文档失败')
  }
}

/**
 * 获取文档统计
 */
export async function getDocumentStats(req, res) {
  try {
    const { billId, customerId } = req.query
    const stats = await model.getDocumentStats({ billId, customerId })
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
    const { id } = req.params
    
    const document = await model.getDocumentById(id)
    if (!document) {
      return notFound(res, '文档不存在')
    }
    
    // 权限检查
    const accessCheck = await model.checkDocumentAccess(id, req.user?.id, req.user?.role)
    if (!accessCheck.hasAccess) {
      return forbidden(res, accessCheck.reason)
    }
    
    // 获取版本历史
    const versions = await model.getDocumentVersions(document.id)
    
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
 * 上传文档到COS
 */
export async function uploadDocument(req, res) {
  try {
    // 检查COS配置
    const cosConfigCheck = cosService.checkCosConfig()
    if (!cosConfigCheck.configured) {
      return serverError(res, 'COS存储未配置，请联系管理员')
    }
    
    // 检查是否有文件
    if (!req.file) {
      return badRequest(res, '请选择要上传的文件')
    }
    
    const {
      documentName,
      documentType = 'other',
      billId,
      billNumber,
      customerId,
      customerName,
      description,
      accessLevel = 'order_related',
      isPublic = true,
      tags
    } = req.body
    
    const file = req.file
    const originalName = file.originalname
    const fileExtension = path.extname(originalName).toLowerCase()
    
    // 上传到COS
    const uploadResult = await cosService.uploadDocument({
      body: file.buffer,
      fileName: originalName,
      billNumber: billNumber || billId,
      documentType
    })
    
    if (!uploadResult.success) {
      return serverError(res, '文件上传失败')
    }
    
    // 保存文档记录到数据库
    const cosConfig = cosService.getCosConfig()
    const result = await model.createDocument({
      documentName: documentName || originalName,
      originalName,
      documentType,
      billId,
      billNumber,
      customerId,
      customerName,
      cosKey: uploadResult.key,
      cosUrl: uploadResult.url,
      cosBucket: cosConfig.bucket,
      cosRegion: cosConfig.region,
      fileSize: file.size,
      mimeType: uploadResult.mimeType || file.mimetype,
      fileExtension,
      accessLevel,
      isPublic: isPublic === true || isPublic === 'true',
      description,
      tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
      uploadedBy: req.user?.id,
      uploadedByName: req.user?.name || req.user?.username || ''
    })
    
    const newDocument = await model.getDocumentById(result.id)
    return success(res, newDocument, '上传成功')
  } catch (error) {
    console.error('上传文档失败:', error)
    return serverError(res, '上传文档失败: ' + error.message)
  }
}

/**
 * 批量上传文档
 */
export async function uploadDocuments(req, res) {
  try {
    // 检查COS配置
    const cosConfigCheck = cosService.checkCosConfig()
    if (!cosConfigCheck.configured) {
      return serverError(res, 'COS存储未配置，请联系管理员')
    }
    
    // 检查是否有文件
    if (!req.files || req.files.length === 0) {
      return badRequest(res, '请选择要上传的文件')
    }
    
    const {
      documentType = 'other',
      billId,
      billNumber,
      customerId,
      customerName,
      accessLevel = 'order_related',
      isPublic = true
    } = req.body
    
    const results = []
    const cosConfig = cosService.getCosConfig()
    
    for (const file of req.files) {
      try {
        const originalName = file.originalname
        const fileExtension = path.extname(originalName).toLowerCase()
        
        // 上传到COS
        const uploadResult = await cosService.uploadDocument({
          body: file.buffer,
          fileName: originalName,
          billNumber: billNumber || billId,
          documentType
        })
        
        if (uploadResult.success) {
          // 保存文档记录
          const docResult = await model.createDocument({
            documentName: originalName,
            originalName,
            documentType,
            billId,
            billNumber,
            customerId,
            customerName,
            cosKey: uploadResult.key,
            cosUrl: uploadResult.url,
            cosBucket: cosConfig.bucket,
            cosRegion: cosConfig.region,
            fileSize: file.size,
            mimeType: uploadResult.mimeType || file.mimetype,
            fileExtension,
            accessLevel,
            isPublic: isPublic === true || isPublic === 'true',
            uploadedBy: req.user?.id,
            uploadedByName: req.user?.name || req.user?.username || ''
          })
          
          const newDocument = await model.getDocumentById(docResult.id)
          results.push({ success: true, document: newDocument })
        } else {
          results.push({ success: false, fileName: originalName, error: '上传失败' })
        }
      } catch (err) {
        results.push({ success: false, fileName: file.originalname, error: err.message })
      }
    }
    
    const successCount = results.filter(r => r.success).length
    return success(res, {
      total: req.files.length,
      successCount,
      failedCount: req.files.length - successCount,
      results
    }, `上传完成，成功${successCount}个，失败${req.files.length - successCount}个`)
  } catch (error) {
    console.error('批量上传文档失败:', error)
    return serverError(res, '批量上传文档失败')
  }
}

/**
 * 更新文档信息
 */
export async function updateDocument(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getDocumentById(id)
    if (!existing) {
      return notFound(res, '文档不存在')
    }
    
    // 权限检查：只有上传者和管理员可以修改
    if (existing.uploadedBy !== req.user?.id && req.user?.role !== 'admin') {
      return forbidden(res, '无权修改此文档')
    }
    
    const updated = await model.updateDocument(id, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedDocument = await model.getDocumentById(id)
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
    const { hard } = req.query // 是否硬删除
    
    const existing = await model.getDocumentById(id)
    if (!existing) {
      return notFound(res, '文档不存在')
    }
    
    // 权限检查：只有上传者和管理员可以删除
    if (existing.uploadedBy !== req.user?.id && req.user?.role !== 'admin') {
      return forbidden(res, '无权删除此文档')
    }
    
    if (hard === 'true' && existing.cosKey) {
      // 硬删除：同时删除COS文件
      try {
        await cosService.deleteDocument(existing.cosKey)
      } catch (cosError) {
        console.error('删除COS文件失败:', cosError)
        // 继续删除数据库记录
      }
      await model.hardDeleteDocument(id)
    } else {
      // 软删除
      await model.deleteDocument(id)
    }
    
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除文档失败:', error)
    return serverError(res, '删除文档失败')
  }
}

/**
 * 批量删除文档
 */
export async function deleteDocuments(req, res) {
  try {
    const { ids } = req.body
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return badRequest(res, '请提供要删除的文档ID列表')
    }
    
    // 权限检查
    if (req.user?.role !== 'admin') {
      // 非管理员只能删除自己上传的文档
      for (const id of ids) {
        const doc = await model.getDocumentById(id)
        if (doc && doc.uploadedBy !== req.user?.id) {
          return forbidden(res, '部分文档无权删除')
        }
      }
    }
    
    const deletedCount = await model.deleteDocuments(ids)
    return success(res, { deletedCount }, `成功删除${deletedCount}个文档`)
  } catch (error) {
    console.error('批量删除文档失败:', error)
    return serverError(res, '批量删除文档失败')
  }
}

// ==================== 文档访问 ====================

/**
 * 获取文档预览URL（签名URL）
 */
export async function getPreviewUrl(req, res) {
  try {
    const { id } = req.params
    const { expires = 3600 } = req.query // 默认1小时有效期
    
    const document = await model.getDocumentById(id)
    if (!document) {
      return notFound(res, '文档不存在')
    }
    
    // 权限检查
    const accessCheck = await model.checkDocumentAccess(id, req.user?.id, req.user?.role)
    if (!accessCheck.hasAccess) {
      return forbidden(res, accessCheck.reason)
    }
    
    if (!document.cosKey) {
      return badRequest(res, '文档文件不存在')
    }
    
    const signedUrl = await cosService.getSignedUrl(document.cosKey, parseInt(expires))
    
    return success(res, {
      url: signedUrl,
      expiresIn: parseInt(expires),
      mimeType: document.mimeType,
      fileName: document.originalName
    })
  } catch (error) {
    console.error('获取预览URL失败:', error)
    return serverError(res, '获取预览URL失败')
  }
}

/**
 * 获取文档下载URL
 */
export async function getDownloadUrl(req, res) {
  try {
    const { id } = req.params
    const { expires = 3600 } = req.query
    
    const document = await model.getDocumentById(id)
    if (!document) {
      return notFound(res, '文档不存在')
    }
    
    // 权限检查
    const accessCheck = await model.checkDocumentAccess(id, req.user?.id, req.user?.role)
    if (!accessCheck.hasAccess) {
      return forbidden(res, accessCheck.reason)
    }
    
    if (!document.cosKey) {
      return badRequest(res, '文档文件不存在')
    }
    
    const downloadUrl = await cosService.getDownloadUrl(
      document.cosKey, 
      document.originalName,
      parseInt(expires)
    )
    
    return success(res, {
      url: downloadUrl,
      expiresIn: parseInt(expires),
      fileName: document.originalName
    })
  } catch (error) {
    console.error('获取下载URL失败:', error)
    return serverError(res, '获取下载URL失败')
  }
}

// ==================== 订单文档关联 ====================

/**
 * 关联文档到订单
 */
export async function linkToOrder(req, res) {
  try {
    const { id } = req.params
    const { billId, billNumber } = req.body
    
    if (!billId) {
      return badRequest(res, '订单ID为必填项')
    }
    
    const document = await model.getDocumentById(id)
    if (!document) {
      return notFound(res, '文档不存在')
    }
    
    await model.linkDocumentToOrder(id, billId, billNumber)
    const updatedDocument = await model.getDocumentById(id)
    
    return success(res, updatedDocument, '关联成功')
  } catch (error) {
    console.error('关联文档失败:', error)
    return serverError(res, '关联文档失败')
  }
}

/**
 * 解除文档与订单的关联
 */
export async function unlinkFromOrder(req, res) {
  try {
    const { id } = req.params
    
    const document = await model.getDocumentById(id)
    if (!document) {
      return notFound(res, '文档不存在')
    }
    
    await model.unlinkDocumentFromOrder(id)
    const updatedDocument = await model.getDocumentById(id)
    
    return success(res, updatedDocument, '解除关联成功')
  } catch (error) {
    console.error('解除文档关联失败:', error)
    return serverError(res, '解除文档关联失败')
  }
}

// ==================== 版本管理 ====================

/**
 * 获取文档版本历史
 */
export async function getDocumentVersions(req, res) {
  try {
    const { id } = req.params
    
    const document = await model.getDocumentById(id)
    if (!document) {
      return notFound(res, '文档不存在')
    }
    
    const versions = await model.getDocumentVersions(id)
    return success(res, versions)
  } catch (error) {
    console.error('获取版本历史失败:', error)
    return serverError(res, '获取版本历史失败')
  }
}

/**
 * 上传新版本
 */
export async function uploadNewVersion(req, res) {
  try {
    const { id } = req.params
    const { changeNote } = req.body
    
    const document = await model.getDocumentById(id)
    if (!document) {
      return notFound(res, '文档不存在')
    }
    
    // 检查COS配置
    const cosConfigCheck = cosService.checkCosConfig()
    if (!cosConfigCheck.configured) {
      return serverError(res, 'COS存储未配置')
    }
    
    if (!req.file) {
      return badRequest(res, '请上传文件')
    }
    
    const file = req.file
    const originalName = file.originalname
    
    // 上传到COS
    const uploadResult = await cosService.uploadDocument({
      body: file.buffer,
      fileName: originalName,
      billNumber: document.billNumber,
      documentType: document.documentType
    })
    
    if (!uploadResult.success) {
      return serverError(res, '文件上传失败')
    }
    
    // 创建新版本记录
    const result = await model.createDocumentVersion({
      documentId: id,
      cosKey: uploadResult.key,
      cosUrl: uploadResult.url,
      fileSize: file.size,
      changeNote,
      uploadedBy: req.user?.id,
      uploadedByName: req.user?.name || req.user?.username || ''
    })
    
    const updatedDocument = await model.getDocumentById(id)
    return success(res, {
      document: updatedDocument,
      version: result.version
    }, '新版本上传成功')
  } catch (error) {
    console.error('上传新版本失败:', error)
    return serverError(res, '上传新版本失败')
  }
}

// ==================== 文档类型配置 ====================

/**
 * 获取文档类型列表
 */
export async function getDocumentTypes(req, res) {
  try {
    const types = Object.entries(model.DOCUMENT_TYPE_LABELS).map(([value, label]) => ({
      value,
      label
    }))
    return success(res, types)
  } catch (error) {
    console.error('获取文档类型失败:', error)
    return serverError(res, '获取文档类型失败')
  }
}

/**
 * 检查COS配置状态
 */
export async function checkCosStatus(req, res) {
  try {
    const status = cosService.checkCosConfig()
    return success(res, status)
  } catch (error) {
    console.error('检查COS状态失败:', error)
    return serverError(res, '检查COS状态失败')
  }
}
