/**
 * 客户门户 API 模块 - 路由定义
 * 用于客户门户系统的认证和数据访问
 */

import express from 'express'
import * as controller from './controller.js'
import inquiryController from '../inquiry/controller.js'

const router = express.Router()

// ==================== 公开接口（无需认证） ====================

// 客户登录
router.post('/auth/login', controller.login)

// 卡车类型查询（公开接口）
router.get('/truck-types', inquiryController.getTruckTypes)
router.get('/truck-types/recommend', inquiryController.recommendTruckType)

// 地理编码（公开接口）
router.get('/geocode', inquiryController.geocodeAddress)

// 地址自动补全（公开接口）
router.get('/addresses/autosuggest', inquiryController.autosuggestAddress)

// ==================== 受保护接口（需要认证） ====================

// 应用认证中间件到所有后续路由
router.use(controller.authMiddleware)

// 刷新 Token
router.post('/auth/refresh', controller.refreshToken)

// 获取当前用户信息
router.get('/auth/me', controller.getCurrentUser)

// 修改密码
router.post('/auth/change-password', controller.changePassword)

// ==================== 订单接口 ====================

// 获取订单统计
router.get('/orders/stats', controller.getOrderStats)

// 获取订单列表
router.get('/orders', controller.getOrders)

// 获取订单详情
router.get('/orders/:id', controller.getOrderById)

// 创建订单草稿
router.post('/orders', controller.createOrder)

// ==================== 账单接口 ====================

// 获取账单列表
router.get('/invoices', controller.getInvoices)

// 获取账单详情
router.get('/invoices/:id', controller.getInvoiceById)

// 下载发票PDF
router.get('/invoices/:id/pdf', controller.downloadInvoicePdf)

// 下载账单明细Excel
router.get('/invoices/:id/excel', controller.downloadInvoiceExcel)

// ==================== 应付账款接口 ====================

// 获取应付账款汇总
router.get('/payables', controller.getPayables)

// ==================== API 密钥管理接口 ====================

// 获取我的 API 密钥列表
router.get('/api-keys', controller.getMyApiKeys)

// 创建 API 密钥
router.post('/api-keys', controller.createMyApiKey)

// 更新 API 密钥
router.put('/api-keys/:id', controller.updateMyApiKey)

// 删除 API 密钥
router.delete('/api-keys/:id', controller.deleteMyApiKey)

// 获取 API 调用日志
router.get('/api-logs', controller.getMyApiLogs)

// ==================== 询价接口 ====================

// 计算运输费用
router.post('/transport/calculate', inquiryController.calculateTransport)

// 估算清关费用
router.post('/clearance/estimate', inquiryController.estimateClearance)

// 创建询价
router.post('/inquiries', inquiryController.createInquiry)

// 获取询价列表（使用 portal controller 确保只返回当前客户的询价）
router.get('/inquiries', controller.getMyInquiries)

// 获取询价统计
router.get('/inquiries/stats', controller.getMyInquiryStats)

// 获取询价详情
router.get('/inquiries/:id', controller.getMyInquiryById)

// 接受报价
router.post('/inquiries/:id/accept', inquiryController.acceptQuote)

// 拒绝报价
router.post('/inquiries/:id/reject', inquiryController.rejectQuote)

export default router

