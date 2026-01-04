/**
 * 工商信息管理 - 控制器
 */

import { success, badRequest, serverError } from '../../utils/response.js'
import * as model from './model.js'
import * as qichachaService from './qichachaService.js'

// ==================== 企查查API查询 ====================

/**
 * 搜索企业（支持企查查API + 本地缓存）
 * GET /api/business-info/search?keyword=xxx&pageIndex=1&pageSize=10
 */
export async function searchCompany(req, res) {
  try {
    const { keyword, pageIndex = 1, pageSize = 10 } = req.query
    
    if (!keyword || keyword.trim().length < 2) {
      return badRequest(res, '请输入至少2个字符的搜索关键字')
    }
    
    const result = await qichachaService.searchCompany(
      keyword.trim(), 
      parseInt(pageIndex), 
      parseInt(pageSize)
    )
    
    return success(res, result.data, result.warning || '搜索成功')
    
  } catch (error) {
    console.error('搜索企业失败:', error)
    return serverError(res, '搜索企业失败')
  }
}

/**
 * 获取企业详情（支持企查查API + 本地缓存）
 * GET /api/business-info/detail?identifier=xxx
 */
export async function getCompanyDetail(req, res) {
  try {
    const { identifier } = req.query
    
    if (!identifier || identifier.trim().length < 2) {
      return badRequest(res, '请提供企业名称或统一社会信用代码')
    }
    
    const result = await qichachaService.getCompanyDetail(identifier.trim())
    
    if (!result.success) {
      return badRequest(res, result.error)
    }
    
    return success(res, result.data, result.warning || result.cached || '获取成功')
    
  } catch (error) {
    console.error('获取企业详情失败:', error)
    return serverError(res, '获取企业详情失败')
  }
}

/**
 * 检查企查查API配置状态
 * GET /api/business-info/config-status
 */
export async function getConfigStatus(req, res) {
  try {
    const config = qichachaService.checkConfig()
    const stats = await model.getBusinessInfoStats()
    
    return success(res, {
      apiConfigured: config.configured,
      localStats: stats
    })
    
  } catch (error) {
    console.error('获取配置状态失败:', error)
    return serverError(res, '获取配置状态失败')
  }
}

// ==================== 本地工商信息库管理 ====================

/**
 * 获取工商信息列表
 * GET /api/business-info?page=1&pageSize=20&search=xxx
 */
export async function getList(req, res) {
  try {
    const { page = 1, pageSize = 20, search, source, operatingStatus } = req.query
    
    const result = await model.getBusinessInfoList({
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      search,
      source,
      operatingStatus
    })
    
    return success(res, result)
    
  } catch (error) {
    console.error('获取工商信息列表失败:', error)
    return serverError(res, '获取工商信息列表失败')
  }
}

/**
 * 获取单条工商信息
 * GET /api/business-info/:id
 */
export async function getById(req, res) {
  try {
    const { id } = req.params
    
    const data = await model.getBusinessInfoById(id)
    
    if (!data) {
      return badRequest(res, '工商信息不存在')
    }
    
    return success(res, data)
    
  } catch (error) {
    console.error('获取工商信息失败:', error)
    return serverError(res, '获取工商信息失败')
  }
}

/**
 * 手动添加工商信息
 * POST /api/business-info
 */
export async function create(req, res) {
  try {
    const data = req.body
    
    if (!data.companyName) {
      return badRequest(res, '公司名称为必填项')
    }
    
    // 验证信用代码格式（如果提供）
    if (data.creditCode) {
      const validation = qichachaService.validateCreditCode(data.creditCode)
      if (!validation.valid) {
        return badRequest(res, validation.error)
      }
      data.creditCode = validation.code
      
      // 检查是否已存在
      const existing = await model.getBusinessInfoByCreditCode(data.creditCode)
      if (existing) {
        return badRequest(res, '该统一社会信用代码已存在')
      }
    }
    
    // 设置来源为手动添加
    data.source = 'manual'
    
    const result = await model.createBusinessInfo(data)
    
    return success(res, result, '工商信息添加成功')
    
  } catch (error) {
    console.error('添加工商信息失败:', error)
    return serverError(res, '添加工商信息失败')
  }
}

/**
 * 更新工商信息
 * PUT /api/business-info/:id
 */
export async function update(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    const existing = await model.getBusinessInfoById(id)
    if (!existing) {
      return badRequest(res, '工商信息不存在')
    }
    
    // 验证信用代码格式（如果更新）
    if (data.creditCode && data.creditCode !== existing.creditCode) {
      const validation = qichachaService.validateCreditCode(data.creditCode)
      if (!validation.valid) {
        return badRequest(res, validation.error)
      }
      data.creditCode = validation.code
      
      // 检查是否已存在
      const duplicate = await model.getBusinessInfoByCreditCode(data.creditCode)
      if (duplicate && duplicate.id !== id) {
        return badRequest(res, '该统一社会信用代码已被其他记录使用')
      }
    }
    
    await model.updateBusinessInfo(id, data)
    
    return success(res, { id }, '工商信息更新成功')
    
  } catch (error) {
    console.error('更新工商信息失败:', error)
    return serverError(res, '更新工商信息失败')
  }
}

/**
 * 删除工商信息
 * DELETE /api/business-info/:id
 */
export async function remove(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getBusinessInfoById(id)
    if (!existing) {
      return badRequest(res, '工商信息不存在')
    }
    
    await model.deleteBusinessInfo(id)
    
    return success(res, null, '工商信息删除成功')
    
  } catch (error) {
    console.error('删除工商信息失败:', error)
    
    // 处理关联错误
    if (error.message.includes('已被')) {
      return badRequest(res, error.message)
    }
    
    return serverError(res, '删除工商信息失败')
  }
}

/**
 * 从工商信息库选择并关联到客户
 * POST /api/business-info/:id/link-customer
 */
export async function linkToCustomer(req, res) {
  try {
    const { id } = req.params
    const { customerId } = req.body
    
    if (!customerId) {
      return badRequest(res, '客户ID为必填项')
    }
    
    const businessInfo = await model.getBusinessInfoById(id)
    if (!businessInfo) {
      return badRequest(res, '工商信息不存在')
    }
    
    // 更新客户的 business_info_id
    const { getDatabase } = await import('../../config/database.js')
    const db = getDatabase()
    
    await db.prepare(`
      UPDATE customers 
      SET business_info_id = ?,
          company_name = COALESCE(?, company_name),
          tax_number = COALESCE(?, tax_number),
          legal_person = COALESCE(?, legal_person),
          registered_capital = COALESCE(?, registered_capital),
          establishment_date = COALESCE(?, establishment_date),
          business_scope = COALESCE(?, business_scope),
          address = COALESCE(?, address),
          updated_at = NOW()
      WHERE id = ?
    `).run(
      id,
      businessInfo.companyName,
      businessInfo.creditCode,
      businessInfo.legalPerson,
      businessInfo.registeredCapital,
      businessInfo.establishmentDate,
      businessInfo.businessScope,
      businessInfo.address,
      customerId
    )
    
    // 增加使用次数
    await model.incrementUsageCount(id)
    
    return success(res, { businessInfoId: id, customerId }, '工商信息关联成功')
    
  } catch (error) {
    console.error('关联工商信息失败:', error)
    return serverError(res, '关联工商信息失败')
  }
}

/**
 * 获取统计信息
 * GET /api/business-info/stats
 */
export async function getStats(req, res) {
  try {
    const stats = await model.getBusinessInfoStats()
    return success(res, stats)
  } catch (error) {
    console.error('获取统计信息失败:', error)
    return serverError(res, '获取统计信息失败')
  }
}

export default {
  searchCompany,
  getCompanyDetail,
  getConfigStatus,
  getList,
  getById,
  create,
  update,
  remove,
  linkToCustomer,
  getStats
}

