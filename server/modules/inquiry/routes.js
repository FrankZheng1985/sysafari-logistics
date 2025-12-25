/**
 * 客户询价模块 - 路由定义
 */

import { Router } from 'express'
import controller from './controller.js'

const router = Router()

// ==================== 卡车类型（公开接口） ====================

// 获取卡车类型列表
router.get('/truck-types', controller.getTruckTypes)

// 推荐卡车类型
router.get('/truck-types/recommend', controller.recommendTruckType)

// ==================== 地理编码 ====================

// 地址地理编码
router.get('/geocode', controller.geocodeAddress)

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

export default router

