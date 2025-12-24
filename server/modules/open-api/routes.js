/**
 * 开放 API 模块 - 路由定义
 * 供客户 ERP/WMS 系统对接使用
 */

import express from 'express'
import * as controller from './controller.js'

const router = express.Router()

// ==================== API 密钥认证 ====================

// 所有路由都需要 API 密钥认证
router.use(controller.apiKeyAuth)

// ==================== 订单接口 ====================

// 批量创建订单
router.post('/orders', controller.createOrders)

// 获取订单详情（支持订单ID或外部订单号）
router.get('/orders/:id', controller.getOrder)

// 更新订单信息
router.put('/orders/:id', controller.updateOrder)

// ==================== 订单状态接口 ====================

// 批量查询订单状态
router.get('/orders/status', controller.getOrdersStatus)

// 获取订单物流跟踪信息
router.get('/orders/tracking/:id', controller.getOrderTracking)

// ==================== 账单接口 ====================

// 获取账单列表
router.get('/invoices', controller.getInvoices)

// 获取账户余额
router.get('/balance', controller.getBalance)

// ==================== Webhook 接口 ====================

// 测试 Webhook 连通性
router.post('/webhook/test', controller.testWebhook)

export default router

