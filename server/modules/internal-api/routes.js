/**
 * 内部 API 模块 - 路由定义
 * 供集团ERP等内部系统对接使用
 * 使用 API Key 认证
 */

import express from 'express'
import { apiKeyAuth } from '../../middleware/apiKeyAuth.js'
import * as controller from './controller.js'

const router = express.Router()

// ==================== API 密钥认证 ====================
// 所有路由都需要 API Key 认证
router.use(apiKeyAuth)

// ==================== 系统健康检查 ====================
router.get('/health', controller.healthCheck)

// ==================== 订单数据同步接口 ====================

// 获取订单列表（支持分页、日期筛选）
router.get('/orders', controller.getOrders)

// 获取订单详情
router.get('/orders/:id', controller.getOrderDetail)

// 获取订单统计
router.get('/orders/stats', controller.getOrderStats)

// ==================== 发票数据同步接口 ====================

// 获取发票列表
router.get('/invoices', controller.getInvoices)

// 获取发票详情
router.get('/invoices/:id', controller.getInvoiceDetail)

// ==================== 付款数据同步接口 ====================

// 获取付款记录列表
router.get('/payments', controller.getPayments)

// 获取付款详情
router.get('/payments/:id', controller.getPaymentDetail)

// ==================== 客户数据同步接口 ====================

// 获取客户列表
router.get('/customers', controller.getCustomers)

// 获取客户详情
router.get('/customers/:id', controller.getCustomerDetail)

// ==================== 统计数据接口 ====================

// 获取综合统计数据
router.get('/stats', controller.getStats)

// 获取财务汇总
router.get('/financial-summary', controller.getFinancialSummary)

// 获取月度统计
router.get('/monthly-stats', controller.getMonthlyStats)

export default router
