/**
 * 客户询价模块 - 路由定义
 */

import { Router } from 'express'
import controller from './controller.js'
import { authenticate, optionalAuth } from '../../middleware/auth.js'

const router = Router()

// ==================== 卡车类型（公开接口） ====================

// 获取卡车类型列表
router.get('/truck-types', controller.getTruckTypes)

// 推荐卡车类型
router.get('/truck-types/recommend', controller.recommendTruckType)

// ==================== 地理编码 ====================

// 地址地理编码
router.get('/geocode', controller.geocodeAddress)

// 批量获取邮编对应的城市
router.post('/cities-by-postal', controller.batchGetCitiesByPostalCodes)

// ==================== 运输计算 ====================

// 计算运输费用
router.post('/transport/calculate', controller.calculateTransport)

// ==================== 清关估算 ====================

// 估算清关费用
router.post('/clearance/estimate', controller.estimateClearance)

// ==================== 询价管理（需要客户认证） ====================

// 创建询价
router.post('/inquiries', controller.createInquiry)

// 获取询价列表
router.get('/inquiries', controller.getInquiries)

// 获取询价详情
router.get('/inquiries/:id', controller.getInquiryById)

// 接受报价
router.post('/inquiries/:id/accept', controller.acceptQuote)

// 拒绝报价
router.post('/inquiries/:id/reject', controller.rejectQuote)

// ==================== ERP后台管理接口（需要认证） ====================

// 获取所有询价列表（ERP后台）
router.get('/manage/inquiries', optionalAuth, controller.getAllInquiries)

// 设置询价报价（ERP后台）
router.post('/manage/inquiries/:id/quote', authenticate, controller.setQuote)

// 分配询价给跟单员
router.post('/manage/inquiries/:id/assign', authenticate, controller.assignInquiry)

// 开始处理询价
router.post('/manage/inquiries/:id/start', authenticate, controller.startProcessing)

// ==================== 待办任务管理（需要认证） ====================

// 获取待处理任务列表
router.get('/tasks/pending', authenticate, controller.getPendingTasks)

// 获取任务统计
router.get('/tasks/stats', authenticate, controller.getTaskStats)

// 检查超时任务（定时任务调用）
router.post('/tasks/check-overdue', controller.checkOverdueTasks)

export default router

