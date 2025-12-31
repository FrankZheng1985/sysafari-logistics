/**
 * API对接管理模块 - 控制器
 */

import { success, badRequest, notFound, serverError } from '../../utils/response.js'
import * as apiIntegrations from './apiIntegrations.js'

/**
 * 获取API服务列表
 */
export async function getApiIntegrations(req, res) {
  try {
    const { category, status, search } = req.query
    const result = await apiIntegrations.getApiIntegrations({ category, status, search })
    return success(res, result)
  } catch (error) {
    console.error('获取API列表失败:', error)
    return serverError(res, '获取API列表失败')
  }
}

/**
 * 获取单个API详情
 */
export async function getApiByCode(req, res) {
  try {
    const { code } = req.params
    const api = await apiIntegrations.getApiByCode(code)
    
    if (!api) {
      return notFound(res, 'API不存在')
    }
    
    return success(res, api)
  } catch (error) {
    console.error('获取API详情失败:', error)
    return serverError(res, '获取API详情失败')
  }
}

/**
 * 更新API配置
 */
export async function updateApi(req, res) {
  try {
    const { code } = req.params
    const data = req.body
    
    const existing = await apiIntegrations.getApiByCode(code)
    if (!existing) {
      return notFound(res, 'API不存在')
    }
    
    const updated = await apiIntegrations.updateApi(code, data)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const api = await apiIntegrations.getApiByCode(code)
    return success(res, api, '更新成功')
  } catch (error) {
    console.error('更新API配置失败:', error)
    return serverError(res, '更新API配置失败')
  }
}

/**
 * 添加新API
 */
export async function createApi(req, res) {
  try {
    const data = req.body
    
    if (!data.apiCode || !data.apiName) {
      return badRequest(res, 'API代码和名称为必填项')
    }
    
    // 检查是否已存在
    const existing = await apiIntegrations.getApiByCode(data.apiCode)
    if (existing) {
      return badRequest(res, 'API代码已存在')
    }
    
    const result = await apiIntegrations.createApi(data)
    const api = await apiIntegrations.getApiByCode(data.apiCode)
    
    return success(res, api, '创建成功')
  } catch (error) {
    console.error('创建API失败:', error)
    return serverError(res, '创建API失败')
  }
}

/**
 * 删除API
 */
export async function deleteApi(req, res) {
  try {
    const { code } = req.params
    
    const existing = await apiIntegrations.getApiByCode(code)
    if (!existing) {
      return notFound(res, 'API不存在')
    }
    
    await apiIntegrations.deleteApi(code)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除API失败:', error)
    return serverError(res, '删除API失败')
  }
}

/**
 * 单个API健康检查
 */
export async function healthCheck(req, res) {
  try {
    const { code } = req.params
    
    const existing = await apiIntegrations.getApiByCode(code)
    if (!existing) {
      return notFound(res, 'API不存在')
    }
    
    const result = await apiIntegrations.performHealthCheck(code)
    return success(res, result)
  } catch (error) {
    console.error('健康检查失败:', error)
    return serverError(res, '健康检查失败')
  }
}

/**
 * 批量健康检查所有API
 */
export async function healthCheckAll(req, res) {
  try {
    const results = await apiIntegrations.performHealthCheckAll()
    return success(res, results)
  } catch (error) {
    console.error('批量健康检查失败:', error)
    return serverError(res, '批量健康检查失败')
  }
}

/**
 * 获取用量历史
 */
export async function getUsageHistory(req, res) {
  try {
    const { code } = req.params
    const { startDate, endDate, limit } = req.query
    
    const history = await apiIntegrations.getUsageHistory(code, {
      startDate,
      endDate,
      limit: parseInt(limit) || 30
    })
    
    return success(res, history)
  } catch (error) {
    console.error('获取用量历史失败:', error)
    return serverError(res, '获取用量历史失败')
  }
}

/**
 * 同步用量数据（手动录入）
 */
export async function syncUsage(req, res) {
  try {
    const { code } = req.params
    const { callCount, successCount, failCount, dataVolume, cost } = req.body
    
    const existing = await apiIntegrations.getApiByCode(code)
    if (!existing) {
      return notFound(res, 'API不存在')
    }
    
    await apiIntegrations.recordUsage(code, {
      callCount: callCount || 0,
      success: successCount > 0,
      dataVolume: dataVolume || 0,
      cost: cost || 0
    })
    
    return success(res, null, '用量同步成功')
  } catch (error) {
    console.error('同步用量失败:', error)
    return serverError(res, '同步用量失败')
  }
}

/**
 * 记录充值
 */
export async function recordRecharge(req, res) {
  try {
    const { code } = req.params
    const { amount, currency, paymentMethod, referenceNo, remark } = req.body
    
    if (!amount || amount <= 0) {
      return badRequest(res, '充值金额必须大于0')
    }
    
    const existing = await apiIntegrations.getApiByCode(code)
    if (!existing) {
      return notFound(res, 'API不存在')
    }
    
    await apiIntegrations.recordRecharge(code, {
      amount,
      currency,
      paymentMethod,
      referenceNo,
      remark,
      operator: req.user?.name || '系统'
    })
    
    const api = await apiIntegrations.getApiByCode(code)
    return success(res, api, '充值记录成功')
  } catch (error) {
    console.error('记录充值失败:', error)
    return serverError(res, '记录充值失败')
  }
}

/**
 * 获取充值记录
 */
export async function getRechargeHistory(req, res) {
  try {
    const { code } = req.params
    const { limit } = req.query
    
    const history = await apiIntegrations.getRechargeHistory(code, {
      limit: parseInt(limit) || 20
    })
    
    return success(res, history)
  } catch (error) {
    console.error('获取充值记录失败:', error)
    return serverError(res, '获取充值记录失败')
  }
}

/**
 * 获取分类列表
 */
export async function getCategories(req, res) {
  try {
    const categories = apiIntegrations.getCategories()
    return success(res, categories)
  } catch (error) {
    console.error('获取分类列表失败:', error)
    return serverError(res, '获取分类列表失败')
  }
}

/**
 * 同步单个API数据（余额、用量）
 */
export async function syncApiData(req, res) {
  try {
    const { code } = req.params
    
    const existing = await apiIntegrations.getApiByCode(code)
    if (!existing) {
      return notFound(res, 'API不存在')
    }
    
    const result = await apiIntegrations.syncApiData(code)
    
    if (result.success) {
      // 重新获取更新后的API信息
      const api = await apiIntegrations.getApiByCode(code)
      return success(res, { ...result.data, api }, '同步成功')
    } else {
      return badRequest(res, result.error || '同步失败')
    }
  } catch (error) {
    console.error('同步API数据失败:', error)
    return serverError(res, '同步API数据失败')
  }
}

/**
 * 同步所有支持自动同步的API数据
 */
export async function syncAllApiData(req, res) {
  try {
    const results = await apiIntegrations.syncAllApiData()
    return success(res, results, '批量同步完成')
  } catch (error) {
    console.error('批量同步失败:', error)
    return serverError(res, '批量同步失败')
  }
}

/**
 * 获取COS存储桶使用情况
 */
export async function getCosStorage(req, res) {
  try {
    const { getCosBucketStorage } = await import('./tencentCloudSync.js')
    const result = await getCosBucketStorage()
    
    if (result.success) {
      return success(res, result.data)
    } else {
      return badRequest(res, result.error || '获取存储信息失败')
    }
  } catch (error) {
    console.error('获取COS存储信息失败:', error)
    return serverError(res, '获取COS存储信息失败')
  }
}

export default {
  getApiIntegrations,
  getApiByCode,
  updateApi,
  createApi,
  deleteApi,
  healthCheck,
  healthCheckAll,
  getUsageHistory,
  syncUsage,
  recordRecharge,
  getRechargeHistory,
  getCategories,
  syncApiData,
  syncAllApiData,
  getCosStorage
}
