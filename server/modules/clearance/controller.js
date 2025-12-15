/**
 * 清关单证模块 - 控制器
 */

import { success, successWithPagination, badRequest, notFound, serverError } from '../../utils/response.js'
import * as model from './model.js'

// ==================== 单证类型 ====================

/**
 * 获取单证类型列表
 */
export async function getDocumentTypes(req, res) {
  try {
    const types = await model.getDocumentTypes(req.query)
    return success(res, types)
  } catch (error) {
    console.error('获取单证类型列表失败:', error)
    return serverError(res, '获取单证类型列表失败')
  }
}

// ==================== 清关单证管理 ====================

/**
 * 获取清关单证列表
 */
export async function getClearanceDocuments(req, res) {
  try {
    const { page, pageSize, ...filters } = req.query
    const result = await model.getClearanceDocuments({
      ...filters,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取清关单证列表失败:', error)
    return serverError(res, '获取清关单证列表失败')
  }
}

/**
 * 获取清关单证统计
 */
export async function getClearanceStats(req, res) {
  try {
    const stats = await model.getClearanceStats(req.query)
    return success(res, stats)
  } catch (error) {
    console.error('获取清关单证统计失败:', error)
    return serverError(res, '获取清关单证统计失败')
  }
}

/**
 * 获取清关单证详情
 */
export async function getClearanceDocumentById(req, res) {
  try {
    const { id } = req.params
    const doc = await model.getClearanceDocumentById(id)
    if (!doc) {
      return notFound(res, '单证不存在')
    }
    return success(res, doc)
  } catch (error) {
    console.error('获取清关单证详情失败:', error)
    return serverError(res, '获取清关单证详情失败')
  }
}

/**
 * 获取订单的清关单证
 */
export async function getClearanceDocumentsByBill(req, res) {
  try {
    const { billId } = req.params
    const docs = await model.getClearanceDocumentsByBill(billId)
    return success(res, docs)
  } catch (error) {
    console.error('获取订单清关单证失败:', error)
    return serverError(res, '获取订单清关单证失败')
  }
}

/**
 * 创建清关单证
 */
export async function createClearanceDocument(req, res) {
  try {
    const data = req.body
    
    // 验证必填字段
    if (!data.documentType) {
      return badRequest(res, '单证类型不能为空')
    }
    
    // 添加操作人信息
    data.createdBy = req.user?.id || null
    data.createdByName = req.user?.name || ''
    
    const result = await model.createClearanceDocument(data)
    return success(res, result, '创建成功')
  } catch (error) {
    console.error('创建清关单证失败:', error)
    return serverError(res, '创建清关单证失败')
  }
}

/**
 * 更新清关单证
 */
export async function updateClearanceDocument(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    // 检查单证是否存在
    const existing = await model.getClearanceDocumentById(id)
    if (!existing) {
      return notFound(res, '单证不存在')
    }
    
    const result = await model.updateClearanceDocument(id, data)
    if (result) {
      return success(res, { id }, '更新成功')
    } else {
      return badRequest(res, '更新失败')
    }
  } catch (error) {
    console.error('更新清关单证失败:', error)
    return serverError(res, '更新清关单证失败')
  }
}

/**
 * 删除清关单证
 */
export async function deleteClearanceDocument(req, res) {
  try {
    const { id } = req.params
    
    // 检查单证是否存在
    const existing = await model.getClearanceDocumentById(id)
    if (!existing) {
      return notFound(res, '单证不存在')
    }
    
    const result = await model.deleteClearanceDocument(id)
    if (result) {
      return success(res, null, '删除成功')
    } else {
      return badRequest(res, '删除失败')
    }
  } catch (error) {
    console.error('删除清关单证失败:', error)
    return serverError(res, '删除清关单证失败')
  }
}

/**
 * 审核清关单证
 */
export async function reviewClearanceDocument(req, res) {
  try {
    const { id } = req.params
    const { reviewStatus, reviewNote } = req.body
    
    if (!reviewStatus || !['approved', 'rejected'].includes(reviewStatus)) {
      return badRequest(res, '审核状态无效')
    }
    
    // 检查单证是否存在
    const existing = await model.getClearanceDocumentById(id)
    if (!existing) {
      return notFound(res, '单证不存在')
    }
    
    const reviewer = req.user?.name || ''
    const result = await model.reviewClearanceDocument(id, reviewStatus, reviewNote, reviewer)
    if (result) {
      return success(res, { id, reviewStatus }, '审核完成')
    } else {
      return badRequest(res, '审核失败')
    }
  } catch (error) {
    console.error('审核清关单证失败:', error)
    return serverError(res, '审核清关单证失败')
  }
}

/**
 * 更新清关单证状态
 */
export async function updateClearanceDocumentStatus(req, res) {
  try {
    const { id } = req.params
    const { status } = req.body
    
    const validStatuses = ['draft', 'pending', 'submitted', 'processing', 'completed', 'rejected', 'cancelled']
    if (!status || !validStatuses.includes(status)) {
      return badRequest(res, '状态值无效')
    }
    
    // 检查单证是否存在
    const existing = await model.getClearanceDocumentById(id)
    if (!existing) {
      return notFound(res, '单证不存在')
    }
    
    const result = await model.updateClearanceDocumentStatus(id, status)
    if (result) {
      return success(res, { id, status }, '状态更新成功')
    } else {
      return badRequest(res, '状态更新失败')
    }
  } catch (error) {
    console.error('更新清关单证状态失败:', error)
    return serverError(res, '更新清关单证状态失败')
  }
}

export default {
  getDocumentTypes,
  getClearanceDocuments,
  getClearanceStats,
  getClearanceDocumentById,
  getClearanceDocumentsByBill,
  createClearanceDocument,
  updateClearanceDocument,
  deleteClearanceDocument,
  reviewClearanceDocument,
  updateClearanceDocumentStatus
}

