/**
 * 供应商管理模块 - 控制器
 */

import { success, successWithPagination, badRequest, notFound, serverError } from '../../utils/response.js'
import * as model from './model.js'

// ==================== 供应商列表 ====================

/**
 * 获取供应商列表
 */
export async function getSupplierList(req, res) {
  try {
    const { search, type, status, level, page, pageSize } = req.query
    
    const result = model.getSupplierList({
      search,
      type,
      status,
      level,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取供应商列表失败:', error)
    return serverError(res, '获取供应商列表失败')
  }
}

/**
 * 获取供应商统计
 */
export async function getSupplierStats(req, res) {
  try {
    const stats = model.getSupplierStats()
    return success(res, stats)
  } catch (error) {
    console.error('获取供应商统计失败:', error)
    return serverError(res, '获取供应商统计失败')
  }
}

/**
 * 获取供应商详情
 */
export async function getSupplierById(req, res) {
  try {
    const supplier = model.getSupplierById(req.params.id)
    if (!supplier) {
      return notFound(res, '供应商不存在')
    }
    return success(res, supplier)
  } catch (error) {
    console.error('获取供应商详情失败:', error)
    return serverError(res, '获取供应商详情失败')
  }
}

/**
 * 获取启用的供应商列表（下拉选择用）
 */
export async function getActiveSuppliers(req, res) {
  try {
    const list = model.getActiveSuppliers()
    return success(res, list)
  } catch (error) {
    console.error('获取供应商选项失败:', error)
    return serverError(res, '获取供应商选项失败')
  }
}

/**
 * 生成供应商编码
 */
export async function generateSupplierCode(req, res) {
  try {
    const code = model.generateSupplierCode()
    return success(res, { code })
  } catch (error) {
    console.error('生成供应商编码失败:', error)
    return serverError(res, '生成供应商编码失败')
  }
}

// ==================== 供应商CRUD ====================

/**
 * 创建供应商
 */
export async function createSupplier(req, res) {
  try {
    const { supplierCode, supplierName } = req.body
    
    // 验证必填字段
    if (!supplierCode || !supplierName) {
      return badRequest(res, '供应商编码和名称为必填项')
    }
    
    // 检查编码是否已存在
    if (model.checkSupplierCodeExists(supplierCode)) {
      return badRequest(res, '供应商编码已存在')
    }
    
    // 添加创建者信息
    const data = {
      ...req.body,
      createdBy: req.user?.name || '系统'
    }
    
    const result = model.createSupplier(data)
    const newSupplier = model.getSupplierById(result.id)
    
    return success(res, newSupplier, '创建成功')
  } catch (error) {
    console.error('创建供应商失败:', error)
    if (error.message?.includes('UNIQUE constraint')) {
      return badRequest(res, '供应商编码已存在')
    }
    return serverError(res, '创建供应商失败')
  }
}

/**
 * 更新供应商
 */
export async function updateSupplier(req, res) {
  try {
    const { id } = req.params
    
    // 检查供应商是否存在
    const existing = model.getSupplierById(id)
    if (!existing) {
      return notFound(res, '供应商不存在')
    }
    
    // 如果修改了编码，检查是否重复
    if (req.body.supplierCode && req.body.supplierCode !== existing.supplierCode) {
      if (model.checkSupplierCodeExists(req.body.supplierCode, id)) {
        return badRequest(res, '供应商编码已存在')
      }
    }
    
    // 添加更新者信息
    const data = {
      ...req.body,
      updatedBy: req.user?.name || '系统'
    }
    
    const updated = model.updateSupplier(id, data)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedSupplier = model.getSupplierById(id)
    return success(res, updatedSupplier, '更新成功')
  } catch (error) {
    console.error('更新供应商失败:', error)
    return serverError(res, '更新供应商失败')
  }
}

/**
 * 删除供应商
 */
export async function deleteSupplier(req, res) {
  try {
    const { id } = req.params
    
    const existing = model.getSupplierById(id)
    if (!existing) {
      return notFound(res, '供应商不存在')
    }
    
    model.deleteSupplier(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除供应商失败:', error)
    return serverError(res, '删除供应商失败')
  }
}

/**
 * 批量删除供应商
 */
export async function batchDeleteSuppliers(req, res) {
  try {
    const { ids } = req.body
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return badRequest(res, '请选择要删除的供应商')
    }
    
    const deletedCount = model.batchDeleteSuppliers(ids)
    return success(res, { deletedCount }, `成功删除 ${deletedCount} 个供应商`)
  } catch (error) {
    console.error('批量删除供应商失败:', error)
    return serverError(res, '批量删除供应商失败')
  }
}

/**
 * 更新供应商状态
 */
export async function updateSupplierStatus(req, res) {
  try {
    const { id } = req.params
    const { status } = req.body
    
    if (!status) {
      return badRequest(res, '状态不能为空')
    }
    
    const existing = model.getSupplierById(id)
    if (!existing) {
      return notFound(res, '供应商不存在')
    }
    
    const updated = model.updateSupplierStatus(id, status, req.user?.name || '系统')
    if (!updated) {
      return badRequest(res, '更新状态失败')
    }
    
    const updatedSupplier = model.getSupplierById(id)
    return success(res, updatedSupplier, '状态更新成功')
  } catch (error) {
    console.error('更新供应商状态失败:', error)
    return serverError(res, '更新供应商状态失败')
  }
}

export default {
  getSupplierList,
  getSupplierStats,
  getSupplierById,
  getActiveSuppliers,
  generateSupplierCode,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  batchDeleteSuppliers,
  updateSupplierStatus
}
