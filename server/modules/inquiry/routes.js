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

// 地址自动补全（HERE API）
router.get('/autosuggest', controller.autosuggestAddress)

// 批量获取邮编对应的城市
router.post('/cities-by-postal', controller.batchGetCitiesByPostalCodes)

// ==================== 运输计算 ====================

// 计算运输费用
router.post('/transport/calculate', controller.calculateTransport)

// 运输报价计算（用于报价弹窗，返回完整路线和费用信息）
router.post('/transport/quote-calculate', controller.calculateTransportQuote)

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

// 作废询价
router.put('/manage/inquiries/:id/void', authenticate, controller.voidInquiry)

// 恢复已作废的询价
router.put('/manage/inquiries/:id/restore', authenticate, controller.restoreInquiry)

// ==================== 待办任务管理（需要认证） ====================

// 获取待处理任务列表
router.get('/tasks/pending', authenticate, controller.getPendingTasks)

// 获取任务统计
router.get('/tasks/stats', authenticate, controller.getTaskStats)

// 检查超时任务（定时任务调用）
router.post('/tasks/check-overdue', controller.checkOverdueTasks)

// ==================== 地址缓存管理（需要认证） ====================

// 获取地址缓存统计
router.get('/address-cache/stats', authenticate, controller.getAddressCacheStats)

// 搜索地址缓存
router.get('/address-cache', authenticate, controller.searchAddressCache)

// 添加地址到缓存
router.post('/address-cache', authenticate, controller.addAddressToCache)

// 删除地址缓存
router.delete('/address-cache/:id', authenticate, controller.deleteAddressCache)

// 清理过期缓存
router.post('/address-cache/cleanup', authenticate, controller.cleanupAddressCache)

// ==================== HERE API 使用量监控 ====================

// 获取 HERE API 使用统计（无需认证，用于显示在API对接管理页面）
router.get('/here-api/usage', controller.getHereApiUsageStats)

// 获取 HERE API 使用历史（无需认证）
router.get('/here-api/usage/history', controller.getHereApiUsageHistory)

// 同步 HERE API 调用次数（需要认证，写操作）
router.post('/here-api/usage/sync', authenticate, controller.syncHereApiCallCount)

export default router

