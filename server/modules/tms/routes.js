/**
 * TMS运输管理模块 - 路由定义
 */

import express from 'express'
import * as controller from './controller.js'

const router = express.Router()

// ==================== CMR管理路由 ====================

// 获取CMR统计
router.get('/cmr/stats', controller.getCMRStats)

// 获取CMR列表（兼容两种路径）
router.get('/cmr/list', controller.getCMRList)
router.get('/cmr', controller.getCMRList)

// 获取CMR详情
router.get('/cmr/:id', controller.getCMRById)

// 更新CMR详情（一次性更新）
router.put('/cmr/:id', controller.updateCMRDetail)

// 获取TMS操作日志
router.get('/cmr/:id/logs', controller.getTMSLogs)

// ==================== CMR派送流程路由 ====================

// Step 1: 开始派送（预计提货时间）
router.post('/cmr/:id/start', controller.startDelivery)

// Step 2: 更新目的地信息
router.post('/cmr/:id/destination', controller.updateDestination)

// Step 3: 记录派送时间
router.post('/cmr/:id/delivery-time', controller.recordDeliveryTime)

// Step 4: 卸货完成
router.post('/cmr/:id/unloading', controller.completeUnloading)

// Step 5: 确认送达
router.post('/cmr/:id/confirm', controller.confirmDelivery)

// ==================== 异常处理路由 ====================

// 标记异常
router.post('/cmr/:id/exception', controller.markException)

// 获取异常历史
router.get('/cmr/:id/exception/history', controller.getExceptionHistory)

// 继续跟进
router.post('/cmr/:id/exception/follow-up', controller.followUpException)

// 解决并继续派送
router.post('/cmr/:id/exception/resolve-continue', controller.resolveAndContinue)

// 标记已解决
router.post('/cmr/:id/exception/resolve', controller.markResolved)

// 关闭订单
router.post('/cmr/:id/exception/close', controller.closeOrder)

// ==================== 服务商管理路由 ====================

// 获取服务商列表
router.get('/service-providers', controller.getServiceProviders)

// 获取单个服务商
router.get('/service-providers/:id', controller.getServiceProviderById)

// 创建服务商
router.post('/service-providers', controller.createServiceProvider)

// 更新服务商
router.put('/service-providers/:id', controller.updateServiceProvider)

// 删除服务商
router.delete('/service-providers/:id', controller.deleteServiceProvider)

// ==================== 考核条件管理路由 ====================

// 获取条件统计
router.get('/conditions/stats', controller.getConditionStats)

// 匹配适用条件
router.get('/conditions/match', controller.matchConditions)

// 获取条件列表
router.get('/conditions', controller.getConditions)

// 获取单个条件
router.get('/conditions/:id', controller.getConditionById)

// 创建条件
router.post('/conditions', controller.createCondition)

// 更新条件
router.put('/conditions/:id', controller.updateCondition)

// 删除条件
router.delete('/conditions/:id', controller.deleteCondition)

// ==================== 考核报表路由 ====================

// 获取考核汇总
router.get('/assessment/summary', controller.getAssessmentSummary)

// 获取服务商排名
router.get('/assessment/provider-rank', controller.getProviderRanking)

// 获取考核报表
router.get('/assessment/report', controller.getAssessmentReport)

// ==================== 最后里程集成路由 ====================

// 获取最后里程承运商列表
router.get('/last-mile-carriers', controller.getLastMileCarriers)

export default router

