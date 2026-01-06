/**
 * 服务订阅管理 - 控制器
 */

import { success, successWithPagination, badRequest, notFound, serverError } from '../../utils/response.js'
import * as model from './model.js'

/**
 * 获取订阅列表
 */
export async function getSubscriptions(req, res) {
  try {
    const { category, status, environment, search, page = 1, pageSize = 50 } = req.query
    
    const result = await model.getSubscriptions({
      category,
      status,
      environment,
      search,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    })
    
    return successWithPagination(res, result.items, result.total, result.page, result.pageSize)
  } catch (error) {
    console.error('获取订阅列表失败:', error)
    return serverError(res, '获取订阅列表失败')
  }
}

/**
 * 获取统计数据
 */
export async function getStatistics(req, res) {
  try {
    const stats = await model.getStatistics()
    return success(res, stats)
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return serverError(res, '获取统计数据失败')
  }
}

/**
 * 获取单个订阅详情
 */
export async function getSubscriptionById(req, res) {
  try {
    const { id } = req.params
    const subscription = await model.getSubscriptionById(id)
    
    if (!subscription) {
      return notFound(res, '订阅不存在')
    }
    
    // 获取操作日志
    const logs = await model.getLogs(id)
    
    return success(res, { ...subscription, logs })
  } catch (error) {
    console.error('获取订阅详情失败:', error)
    return serverError(res, '获取订阅详情失败')
  }
}

/**
 * 创建订阅
 */
export async function createSubscription(req, res) {
  try {
    const data = req.body
    data.createdBy = req.user?.id
    
    if (!data.name || !data.category) {
      return badRequest(res, '名称和分类为必填项')
    }
    
    const result = await model.createSubscription(data)
    return success(res, result, '创建成功')
  } catch (error) {
    console.error('创建订阅失败:', error)
    return serverError(res, '创建订阅失败')
  }
}

/**
 * 更新订阅
 */
export async function updateSubscription(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    data.updatedBy = req.user?.id
    
    const result = await model.updateSubscription(id, data)
    
    if (!result) {
      return notFound(res, '订阅不存在')
    }
    
    return success(res, result, '更新成功')
  } catch (error) {
    console.error('更新订阅失败:', error)
    return serverError(res, '更新订阅失败')
  }
}

/**
 * 删除订阅
 */
export async function deleteSubscription(req, res) {
  try {
    const { id } = req.params
    const result = await model.deleteSubscription(id, req.user?.id)
    
    if (!result) {
      return notFound(res, '订阅不存在')
    }
    
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除订阅失败:', error)
    return serverError(res, '删除订阅失败')
  }
}

/**
 * 续期订阅
 */
export async function renewSubscription(req, res) {
  try {
    const { id } = req.params
    const { expireDate } = req.body
    
    if (!expireDate) {
      return badRequest(res, '新到期日期为必填项')
    }
    
    const result = await model.renewSubscription(id, expireDate, req.user?.id)
    
    if (!result) {
      return notFound(res, '订阅不存在')
    }
    
    return success(res, result, '续期成功')
  } catch (error) {
    console.error('续期失败:', error)
    return serverError(res, '续期失败')
  }
}

/**
 * 检查并更新所有状态
 */
export async function checkAndUpdateStatus(req, res) {
  try {
    const statusResult = await model.updateAllStatus()
    const sslResult = await model.checkAndUpdateSslCertificates()
    
    return success(res, {
      statusUpdate: statusResult,
      sslCheck: sslResult
    }, '状态更新完成')
  } catch (error) {
    console.error('状态更新失败:', error)
    return serverError(res, '状态更新失败')
  }
}

/**
 * 检查单个 SSL 证书
 */
export async function checkSslCertificate(req, res) {
  try {
    const { domain } = req.query
    
    if (!domain) {
      return badRequest(res, '域名为必填项')
    }
    
    const result = await model.checkSslCertificate(domain)
    return success(res, result)
  } catch (error) {
    console.error('SSL检查失败:', error)
    return serverError(res, 'SSL检查失败')
  }
}

/**
 * 获取即将到期的订阅
 */
export async function getExpiringSubscriptions(req, res) {
  try {
    const { days = 30 } = req.query
    const result = await model.getExpiringSubscriptions(parseInt(days))
    return success(res, result)
  } catch (error) {
    console.error('获取即将到期订阅失败:', error)
    return serverError(res, '获取即将到期订阅失败')
  }
}

/**
 * 获取操作日志
 */
export async function getLogs(req, res) {
  try {
    const { id } = req.params
    const { limit = 20 } = req.query
    
    const logs = await model.getLogs(id, parseInt(limit))
    return success(res, logs)
  } catch (error) {
    console.error('获取操作日志失败:', error)
    return serverError(res, '获取操作日志失败')
  }
}

