/**
 * 财务管理模块 - 路由定义
 */

import express from 'express'
import * as controller from './controller.js'

const router = express.Router()

// ==================== 财务概览 ====================

// 获取财务概览
router.get('/finance/overview', controller.getFinanceOverview)

// ==================== 发票管理路由 ====================

// 获取发票统计
router.get('/invoices/stats', controller.getInvoiceStats)

// 获取发票列表
router.get('/invoices', controller.getInvoices)

// 获取发票详情
router.get('/invoices/:id', controller.getInvoiceById)

// 创建发票
router.post('/invoices', controller.createInvoice)

// 更新发票
router.put('/invoices/:id', controller.updateInvoice)

// 删除发票
router.delete('/invoices/:id', controller.deleteInvoice)

// ==================== 付款管理路由 ====================

// 获取付款统计
router.get('/payments/stats', controller.getPaymentStats)

// 获取付款记录列表
router.get('/payments', controller.getPayments)

// 获取付款记录详情
router.get('/payments/:id', controller.getPaymentById)

// 创建付款记录
router.post('/payments', controller.createPayment)

// 更新付款记录
router.put('/payments/:id', controller.updatePayment)

// 删除付款记录
router.delete('/payments/:id', controller.deletePayment)

// ==================== 费用管理路由 ====================

// 获取费用统计
router.get('/fees/stats', controller.getFeeStats)

// 获取费用列表
router.get('/fees', controller.getFees)

// 获取费用详情
router.get('/fees/:id', controller.getFeeById)

// 创建费用
router.post('/fees', controller.createFee)

// 更新费用
router.put('/fees/:id', controller.updateFee)

// 删除费用
router.delete('/fees/:id', controller.deleteFee)

// ==================== 提单财务路由 ====================

// 获取提单财务汇总
router.get('/bills/:billId/finance', controller.getBillFinanceSummary)

// ==================== 报表路由 ====================

// 获取订单维度费用报表
router.get('/finance/reports/orders', controller.getOrderFeeReport)

// 获取客户维度费用报表
router.get('/finance/reports/customers', controller.getCustomerFeeReport)

export default router

