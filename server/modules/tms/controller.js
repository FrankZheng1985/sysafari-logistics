/**
 * TMS运输管理模块 - 控制器
 */

import { success, successWithPagination, badRequest, notFound, serverError } from '../../utils/response.js'
import * as model from './model.js'

// ==================== CMR列表 ====================

/**
 * 获取CMR管理列表
 */
export async function getCMRList(req, res) {
  try {
    const { type, search, page, pageSize } = req.query
    
    const result = await model.getCMRList({
      type: type || 'undelivered',
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      stats: result.stats
    })
  } catch (error) {
    console.error('获取CMR列表失败:', error)
    return serverError(res, '获取CMR列表失败')
  }
}

/**
 * 获取CMR统计
 */
export async function getCMRStats(req, res) {
  try {
    const stats = await model.getCMRStats()
    return success(res, stats)
  } catch (error) {
    console.error('获取CMR统计失败:', error)
    return serverError(res, '获取CMR统计失败')
  }
}

/**
 * 获取CMR详情
 */
export async function getCMRById(req, res) {
  try {
    const cmr = await model.getCMRById(req.params.id)
    if (!cmr) {
      return notFound(res, 'CMR记录不存在')
    }
    return success(res, cmr)
  } catch (error) {
    console.error('获取CMR详情失败:', error)
    return serverError(res, '获取CMR详情失败')
  }
}

// ==================== CMR派送流程 ====================

/**
 * 开始派送（Step 1）
 */
export async function startDelivery(req, res) {
  try {
    const { id } = req.params
    const { estimatedPickupTime, serviceProvider, remark } = req.body
    
    if (!estimatedPickupTime) {
      return badRequest(res, '预计提货时间为必填项')
    }
    
    const cmr = await model.getCMRById(id)
    if (!cmr) {
      return notFound(res, 'CMR记录不存在')
    }
    
    const updated = await model.startDelivery(id, {
      estimatedPickupTime,
      serviceProvider
    })
    
    if (!updated) {
      return badRequest(res, '开始派送失败')
    }
    
    // 记录操作日志
    await model.addTMSLog({
      billId: id,
      operationType: 'delivery_start',
      operationName: '开始派送',
      newValue: JSON.stringify({ estimatedPickupTime, serviceProvider }),
      remark,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id
    })
    
    const updatedCMR = await model.getCMRById(id)
    return success(res, updatedCMR, '派送已开始')
  } catch (error) {
    console.error('开始派送失败:', error)
    return serverError(res, '开始派送失败')
  }
}

/**
 * 更新目的地信息（Step 2）
 */
export async function updateDestination(req, res) {
  try {
    const { id } = req.params
    const { deliveryAddress, estimatedArrivalTime, remark } = req.body
    
    if (!deliveryAddress || !estimatedArrivalTime) {
      return badRequest(res, '派送地址和预计到达时间为必填项')
    }
    
    const cmr = await model.getCMRById(id)
    if (!cmr) {
      return notFound(res, 'CMR记录不存在')
    }
    
    const updated = await model.updateDestination(id, {
      deliveryAddress,
      estimatedArrivalTime
    })
    
    if (!updated) {
      return badRequest(res, '更新目的地信息失败')
    }
    
    // 记录操作日志
    await model.addTMSLog({
      billId: id,
      operationType: 'destination_update',
      operationName: '更新目的地信息',
      newValue: JSON.stringify({ deliveryAddress, estimatedArrivalTime }),
      remark,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id
    })
    
    const updatedCMR = await model.getCMRById(id)
    return success(res, updatedCMR, '目的地信息已更新')
  } catch (error) {
    console.error('更新目的地信息失败:', error)
    return serverError(res, '更新目的地信息失败')
  }
}

/**
 * 记录派送时间（Step 3）
 */
export async function recordDeliveryTime(req, res) {
  try {
    const { id } = req.params
    const { actualArrivalTime, remark } = req.body
    
    if (!actualArrivalTime) {
      return badRequest(res, '实际到达时间为必填项')
    }
    
    const cmr = await model.getCMRById(id)
    if (!cmr) {
      return notFound(res, 'CMR记录不存在')
    }
    
    const updated = await model.recordDeliveryTime(id, { actualArrivalTime })
    
    if (!updated) {
      return badRequest(res, '记录派送时间失败')
    }
    
    // 记录操作日志
    await model.addTMSLog({
      billId: id,
      operationType: 'delivery_time',
      operationName: '记录派送时间',
      newValue: actualArrivalTime,
      remark,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id
    })
    
    const updatedCMR = await model.getCMRById(id)
    return success(res, updatedCMR, '派送时间已记录')
  } catch (error) {
    console.error('记录派送时间失败:', error)
    return serverError(res, '记录派送时间失败')
  }
}

/**
 * 卸货完成（Step 4）
 */
export async function completeUnloading(req, res) {
  try {
    const { id } = req.params
    const { unloadingCompleteTime, remark } = req.body
    
    if (!unloadingCompleteTime) {
      return badRequest(res, '卸货完成时间为必填项')
    }
    
    const cmr = await model.getCMRById(id)
    if (!cmr) {
      return notFound(res, 'CMR记录不存在')
    }
    
    const updated = await model.completeUnloading(id, { unloadingCompleteTime })
    
    if (!updated) {
      return badRequest(res, '记录卸货完成失败')
    }
    
    // 记录操作日志
    await model.addTMSLog({
      billId: id,
      operationType: 'unloading_complete',
      operationName: '卸货完成',
      newValue: unloadingCompleteTime,
      remark,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id
    })
    
    const updatedCMR = await model.getCMRById(id)
    return success(res, updatedCMR, '卸货已完成')
  } catch (error) {
    console.error('记录卸货完成失败:', error)
    return serverError(res, '记录卸货完成失败')
  }
}

/**
 * 确认送达（Step 5）
 */
export async function confirmDelivery(req, res) {
  try {
    const { id } = req.params
    const { confirmedTime, remark } = req.body
    
    const cmr = await model.getCMRById(id)
    if (!cmr) {
      return notFound(res, 'CMR记录不存在')
    }
    
    const updated = await model.confirmDelivery(id, { 
      confirmedTime: confirmedTime || new Date().toISOString() 
    })
    
    if (!updated) {
      return badRequest(res, '确认送达失败')
    }
    
    // 记录操作日志
    await model.addTMSLog({
      billId: id,
      operationType: 'delivery_confirm',
      operationName: '确认送达',
      oldValue: cmr.deliveryStatus,
      newValue: '已送达',
      remark,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id
    })
    
    const updatedCMR = await model.getCMRById(id)
    return success(res, updatedCMR, '派送已确认完成')
  } catch (error) {
    console.error('确认送达失败:', error)
    return serverError(res, '确认送达失败')
  }
}

/**
 * 更新CMR详情（一次性更新）
 */
export async function updateCMRDetail(req, res) {
  try {
    const { id } = req.params
    
    const cmr = await model.getCMRById(id)
    if (!cmr) {
      return notFound(res, 'CMR记录不存在')
    }
    
    const updated = await model.updateCMRDetail(id, req.body)
    
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    // 记录操作日志
    await model.addTMSLog({
      billId: id,
      operationType: 'cmr_update',
      operationName: '更新CMR信息',
      newValue: JSON.stringify(req.body),
      remark: req.body.remark,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id
    })
    
    const updatedCMR = await model.getCMRById(id)
    return success(res, updatedCMR, '更新成功')
  } catch (error) {
    console.error('更新CMR详情失败:', error)
    return serverError(res, '更新CMR详情失败')
  }
}

// ==================== 异常处理 ====================

/**
 * 标记异常
 */
export async function markException(req, res) {
  try {
    const { id } = req.params
    const { exceptionNote, currentStep } = req.body
    
    if (!exceptionNote) {
      return badRequest(res, '异常说明为必填项')
    }
    
    const cmr = await model.getCMRById(id)
    if (!cmr) {
      return notFound(res, 'CMR记录不存在')
    }
    
    const updated = await model.markException(id, {
      exceptionNote,
      currentStep,
      operator: req.user?.name || '系统'
    })
    
    if (!updated) {
      return badRequest(res, '标记异常失败')
    }
    
    // 记录操作日志
    await model.addTMSLog({
      billId: id,
      operationType: 'exception_mark',
      operationName: '标记异常',
      oldValue: cmr.deliveryStatus,
      newValue: '订单异常',
      remark: exceptionNote,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id
    })
    
    const updatedCMR = await model.getCMRById(id)
    return success(res, updatedCMR, '已标记为异常')
  } catch (error) {
    console.error('标记异常失败:', error)
    return serverError(res, '标记异常失败')
  }
}

/**
 * 处理异常 - 继续跟进
 */
export async function followUpException(req, res) {
  try {
    const { id } = req.params
    const { followUpNote } = req.body
    
    if (!followUpNote) {
      return badRequest(res, '跟进说明为必填项')
    }
    
    const cmr = await model.getCMRById(id)
    if (!cmr) {
      return notFound(res, 'CMR记录不存在')
    }
    
    const updated = await model.followUpException(id, {
      followUpNote,
      operator: req.user?.name || '系统'
    })
    
    if (!updated) {
      return badRequest(res, '继续跟进失败')
    }
    
    // 记录操作日志
    await model.addTMSLog({
      billId: id,
      operationType: 'exception_follow_up',
      operationName: '异常跟进',
      remark: followUpNote,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id
    })
    
    const updatedCMR = await model.getCMRById(id)
    return success(res, updatedCMR, '已记录跟进')
  } catch (error) {
    console.error('继续跟进失败:', error)
    return serverError(res, '继续跟进失败')
  }
}

/**
 * 处理异常 - 解决并继续派送
 */
export async function resolveAndContinue(req, res) {
  try {
    const { id } = req.params
    const { resolveNote } = req.body
    
    if (!resolveNote) {
      return badRequest(res, '解决说明为必填项')
    }
    
    const cmr = await model.getCMRById(id)
    if (!cmr) {
      return notFound(res, 'CMR记录不存在')
    }
    
    const updated = await model.resolveAndContinue(id, {
      resolveNote,
      operator: req.user?.name || '系统'
    })
    
    if (!updated) {
      return badRequest(res, '解决异常失败')
    }
    
    // 记录操作日志
    await model.addTMSLog({
      billId: id,
      operationType: 'exception_resolve_continue',
      operationName: '解决异常并继续派送',
      oldValue: '订单异常',
      newValue: '派送中',
      remark: resolveNote,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id
    })
    
    const updatedCMR = await model.getCMRById(id)
    return success(res, updatedCMR, '异常已解决，继续派送')
  } catch (error) {
    console.error('解决并继续派送失败:', error)
    return serverError(res, '解决并继续派送失败')
  }
}

/**
 * 处理异常 - 标记已解决
 */
export async function markResolved(req, res) {
  try {
    const { id } = req.params
    const { resolveNote } = req.body
    
    if (!resolveNote) {
      return badRequest(res, '解决说明为必填项')
    }
    
    const cmr = await model.getCMRById(id)
    if (!cmr) {
      return notFound(res, 'CMR记录不存在')
    }
    
    const updated = await model.markResolved(id, {
      resolveNote,
      operator: req.user?.name || '系统'
    })
    
    if (!updated) {
      return badRequest(res, '标记已解决失败')
    }
    
    // 记录操作日志
    await model.addTMSLog({
      billId: id,
      operationType: 'exception_resolve',
      operationName: '标记异常已解决',
      remark: resolveNote,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id
    })
    
    const updatedCMR = await model.getCMRById(id)
    return success(res, updatedCMR, '已标记为解决')
  } catch (error) {
    console.error('标记已解决失败:', error)
    return serverError(res, '标记已解决失败')
  }
}

/**
 * 处理异常 - 关闭订单
 */
export async function closeOrder(req, res) {
  try {
    const { id } = req.params
    const { closeNote } = req.body
    
    if (!closeNote) {
      return badRequest(res, '关闭说明为必填项')
    }
    
    const cmr = await model.getCMRById(id)
    if (!cmr) {
      return notFound(res, 'CMR记录不存在')
    }
    
    const updated = await model.closeOrder(id, {
      closeNote,
      operator: req.user?.name || '系统'
    })
    
    if (!updated) {
      return badRequest(res, '关闭订单失败')
    }
    
    // 记录操作日志
    await model.addTMSLog({
      billId: id,
      operationType: 'exception_close',
      operationName: '异常关闭订单',
      oldValue: cmr.deliveryStatus,
      newValue: '异常关闭',
      remark: closeNote,
      operator: req.user?.name || '系统',
      operatorId: req.user?.id
    })
    
    const updatedCMR = await model.getCMRById(id)
    return success(res, updatedCMR, '订单已关闭')
  } catch (error) {
    console.error('关闭订单失败:', error)
    return serverError(res, '关闭订单失败')
  }
}

/**
 * 获取异常历史
 */
export async function getExceptionHistory(req, res) {
  try {
    const { id } = req.params
    
    const cmr = await model.getCMRById(id)
    if (!cmr) {
      return notFound(res, 'CMR记录不存在')
    }
    
    const history = await model.getExceptionHistory(id)
    return success(res, history)
  } catch (error) {
    console.error('获取异常历史失败:', error)
    return serverError(res, '获取异常历史失败')
  }
}

// ==================== 服务商管理 ====================

/**
 * 获取服务商列表
 */
export async function getServiceProviders(req, res) {
  try {
    const { type, status, search, page, pageSize } = req.query
    
    const result = await model.getServiceProviders({
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
    console.error('获取服务商列表失败:', error)
    return serverError(res, '获取服务商列表失败')
  }
}

/**
 * 获取单个服务商
 */
export async function getServiceProviderById(req, res) {
  try {
    const provider = await model.getServiceProviderById(req.params.id)
    if (!provider) {
      return notFound(res, '服务商不存在')
    }
    return success(res, provider)
  } catch (error) {
    console.error('获取服务商详情失败:', error)
    return serverError(res, '获取服务商详情失败')
  }
}

/**
 * 创建服务商
 */
export async function createServiceProvider(req, res) {
  try {
    const { providerCode, providerName } = req.body
    
    if (!providerCode || !providerName) {
      return badRequest(res, '服务商代码和名称为必填项')
    }
    
    const result = await model.createServiceProvider(req.body)
    const newProvider = await model.getServiceProviderById(result.id)
    
    return success(res, newProvider, '创建成功')
  } catch (error) {
    console.error('创建服务商失败:', error)
    if (error.message?.includes('UNIQUE constraint')) {
      return badRequest(res, '服务商代码已存在')
    }
    return serverError(res, '创建服务商失败')
  }
}

/**
 * 更新服务商
 */
export async function updateServiceProvider(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getServiceProviderById(id)
    if (!existing) {
      return notFound(res, '服务商不存在')
    }
    
    const updated = await model.updateServiceProvider(id, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedProvider = await model.getServiceProviderById(id)
    return success(res, updatedProvider, '更新成功')
  } catch (error) {
    console.error('更新服务商失败:', error)
    return serverError(res, '更新服务商失败')
  }
}

/**
 * 删除服务商
 */
export async function deleteServiceProvider(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getServiceProviderById(id)
    if (!existing) {
      return notFound(res, '服务商不存在')
    }
    
    model.deleteServiceProvider(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除服务商失败:', error)
    return serverError(res, '删除服务商失败')
  }
}

// ==================== 操作日志 ====================

/**
 * 获取TMS操作日志
 */
export async function getTMSLogs(req, res) {
  try {
    const { id } = req.params
    
    const cmr = await model.getCMRById(id)
    if (!cmr) {
      return notFound(res, 'CMR记录不存在')
    }
    
    const logs = await model.getTMSLogs(id)
    return success(res, logs)
  } catch (error) {
    console.error('获取TMS日志失败:', error)
    return serverError(res, '获取TMS日志失败')
  }
}

// ==================== 考核条件管理 ====================

/**
 * 获取考核条件列表
 */
export async function getConditions(req, res) {
  try {
    const { type, status, search, page, pageSize } = req.query
    
    const result = await model.getConditions({
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
    console.error('获取考核条件列表失败:', error)
    return serverError(res, '获取考核条件列表失败')
  }
}

/**
 * 获取考核条件详情
 */
export async function getConditionById(req, res) {
  try {
    const condition = await model.getConditionById(req.params.id)
    if (!condition) {
      return notFound(res, '考核条件不存在')
    }
    return success(res, condition)
  } catch (error) {
    console.error('获取考核条件详情失败:', error)
    return serverError(res, '获取考核条件详情失败')
  }
}

/**
 * 创建考核条件
 */
export async function createCondition(req, res) {
  try {
    const { conditionCode, conditionName, conditionType } = req.body
    
    if (!conditionCode || !conditionName || !conditionType) {
      return badRequest(res, '条件编码、名称和类型为必填项')
    }
    
    const result = await model.createCondition(req.body)
    const newCondition = await model.getConditionById(result.id)
    
    return success(res, newCondition, '创建成功')
  } catch (error) {
    console.error('创建考核条件失败:', error)
    if (error.message?.includes('条件编码已存在')) {
      return badRequest(res, '条件编码已存在')
    }
    return serverError(res, '创建考核条件失败')
  }
}

/**
 * 更新考核条件
 */
export async function updateCondition(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getConditionById(id)
    if (!existing) {
      return notFound(res, '考核条件不存在')
    }
    
    const updated = await model.updateCondition(id, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedCondition = await model.getConditionById(id)
    return success(res, updatedCondition, '更新成功')
  } catch (error) {
    console.error('更新考核条件失败:', error)
    return serverError(res, '更新考核条件失败')
  }
}

/**
 * 删除考核条件
 */
export async function deleteCondition(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getConditionById(id)
    if (!existing) {
      return notFound(res, '考核条件不存在')
    }
    
    await model.deleteCondition(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除考核条件失败:', error)
    return serverError(res, '删除考核条件失败')
  }
}

/**
 * 匹配适用的考核条件
 */
export async function matchConditions(req, res) {
  try {
    const { type, providerId, routeCode, serviceType } = req.query
    
    const conditions = await model.matchConditions({
      type,
      providerId,
      routeCode,
      serviceType
    })
    
    return success(res, conditions)
  } catch (error) {
    console.error('匹配考核条件失败:', error)
    return serverError(res, '匹配考核条件失败')
  }
}

/**
 * 获取考核条件统计
 */
export async function getConditionStats(req, res) {
  try {
    const stats = await model.getConditionStats()
    return success(res, stats)
  } catch (error) {
    console.error('获取考核条件统计失败:', error)
    return serverError(res, '获取考核条件统计失败')
  }
}

// ==================== 考核报表 ====================

/**
 * 获取考核报表
 */
export async function getAssessmentReport(req, res) {
  try {
    const { providerId, conditionType, period, startDate, endDate, page, pageSize } = req.query
    
    const result = await model.getAssessmentReport({
      providerId: providerId ? parseInt(providerId) : null,
      conditionType,
      period,
      startDate,
      endDate,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取考核报表失败:', error)
    return serverError(res, '获取考核报表失败')
  }
}

/**
 * 获取服务商排名
 */
export async function getProviderRanking(req, res) {
  try {
    const { conditionType, period, limit } = req.query
    
    const rankings = await model.getProviderRanking({
      conditionType,
      period,
      limit: parseInt(limit) || 10
    })
    
    return success(res, rankings)
  } catch (error) {
    console.error('获取服务商排名失败:', error)
    return serverError(res, '获取服务商排名失败')
  }
}

/**
 * 获取考核汇总统计
 */
export async function getAssessmentSummary(req, res) {
  try {
    const { period } = req.query
    
    const summary = await model.getAssessmentSummary({ period })
    return success(res, summary)
  } catch (error) {
    console.error('获取考核汇总失败:', error)
    return serverError(res, '获取考核汇总失败')
  }
}

