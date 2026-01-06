/**
 * 财务管理模块 - 路由定义
 */

import express from 'express'
import multer from 'multer'
import * as controller from './controller.js'
import { authenticate } from '../../middleware/auth.js'

const router = express.Router()

// 配置 multer 用于付款单上传
const paymentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的文件类型，请上传 PDF 或图片文件'))
    }
  }
})

// ==================== 财务概览 ====================

// 获取财务概览
router.get('/finance/overview', controller.getFinanceOverview)

// 获取汇率
router.get('/exchange-rate', controller.getExchangeRate)

// ==================== 发票管理路由 ====================

// 获取发票统计
router.get('/invoices/stats', controller.getInvoiceStats)

// 检查COS存储状态
router.get('/invoices/cos-status', controller.checkCosStatus)

// 从费用记录生成发票
router.post('/invoices/generate', controller.generateInvoiceFromFees)

// 获取发票列表
router.get('/invoices', controller.getInvoices)

// 获取发票详情
router.get('/invoices/:id', controller.getInvoiceById)

// 下载发票PDF
router.get('/invoices/:id/pdf', controller.downloadInvoicePDF)

// 下载发票Excel对账单
router.get('/invoices/:id/excel', controller.downloadInvoiceExcel)

// 下载本地存储的发票文件
router.get('/invoices/files/:filename', controller.downloadLocalInvoiceFile)

// 重新生成发票文件
router.post('/invoices/:id/regenerate', controller.regenerateInvoice)

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

// 上传付款凭证
router.post('/payments/:id/receipt', paymentUpload.single('file'), controller.uploadPaymentReceipt)

// 查看付款凭证
router.get('/payments/:id/receipt', controller.viewPaymentReceipt)

// ==================== 费用管理路由 ====================

// 获取费用统计
router.get('/fees/stats', controller.getFeeStats)

// 获取待审批的追加费用列表
router.get('/fees/pending-approval', controller.getPendingApprovalFees)

// 获取费用列表
router.get('/fees', controller.getFees)

// 获取费用详情
router.get('/fees/:id', controller.getFeeById)

// 创建费用（需要认证以获取用户信息）
router.post('/fees', authenticate, controller.createFee)

// 更新费用（需要认证）
router.put('/fees/:id', authenticate, controller.updateFee)

// 删除费用（需要认证）
router.delete('/fees/:id', authenticate, controller.deleteFee)

// 审批通过费用（需要认证）
router.post('/fees/:id/approve', authenticate, controller.approveFee)

// 审批拒绝费用（需要认证）
router.post('/fees/:id/reject', authenticate, controller.rejectFee)

// 批量审批通过（需要认证）
router.post('/fees/batch-approve', authenticate, controller.batchApproveFees)

// ==================== 提单财务路由 ====================

// 获取提单财务汇总
router.get('/bills/:billId/finance', controller.getBillFinanceSummary)

// ==================== 提单收款确认路由 ====================

// 确认提单收款（锁定费用）
router.post('/bills/:billId/confirm-payment', controller.confirmBillPayment)

// 取消提单收款确认（解锁费用）
router.post('/bills/:billId/cancel-payment-confirm', controller.cancelBillPaymentConfirm)

// 获取提单收款确认状态
router.get('/bills/:billId/payment-status', controller.getBillPaymentStatus)

// 获取提单的主发票号
router.get('/bills/:billId/primary-invoice', controller.getBillPrimaryInvoiceNumber)

// 获取提单的追加发票列表
router.get('/bills/:billId/supplement-invoices', controller.getBillSupplementInvoices)

// ==================== 追加发票路由 ====================

// 创建追加发票
router.post('/invoices/supplement', controller.createSupplementInvoice)

// ==================== 报表路由 ====================

// 获取订单维度费用报表
router.get('/finance/reports/orders', controller.getOrderFeeReport)

// 获取客户维度费用报表
router.get('/finance/reports/customers', controller.getCustomerFeeReport)

// ==================== 银行账户管理路由 ====================

// 获取银行账户列表
router.get('/bank-accounts', controller.getBankAccounts)

// 获取银行账户详情
router.get('/bank-accounts/:id', controller.getBankAccountById)

// 创建银行账户
router.post('/bank-accounts', controller.createBankAccount)

// 更新银行账户
router.put('/bank-accounts/:id', controller.updateBankAccount)

// 删除银行账户
router.delete('/bank-accounts/:id', controller.deleteBankAccount)

// ==================== 财务报表路由 ====================
// 注意：具体路径必须放在参数化路径之前，避免路由冲突

// 获取资产负债表数据
router.get('/finance/reports/balance-sheet', controller.getBalanceSheet)

// 获取利润表数据
router.get('/finance/reports/income-statement', controller.getIncomeStatement)

// 获取现金流量表数据
router.get('/finance/reports/cash-flow', controller.getCashFlowStatement)

// 获取经营分析表数据
router.get('/finance/reports/business-analysis', controller.getBusinessAnalysis)

// 获取财务报表历史列表
router.get('/finance/reports/history', controller.getFinancialReportHistory)

// 下载本地存储的报表文件
router.get('/finance/reports/files/:filename', controller.downloadReportFile)

// 生成并保存财务报表 PDF（参数化路由）
router.post('/finance/reports/:type/generate', controller.generateFinancialReport)

// 获取单个财务报表详情（参数化路由，放在最后）
router.get('/finance/reports/:id', controller.getFinancialReportById)

// ==================== 承运商结算路由 ====================

// 获取结算单列表
router.get('/carrier-settlements', controller.getCarrierSettlements)

// 获取结算统计
router.get('/carrier-settlements/stats', controller.getCarrierSettlementStats)

// 获取结算单详情
router.get('/carrier-settlements/:id', controller.getCarrierSettlementById)

// 创建结算单（按周期自动生成）
router.post('/carrier-settlements/generate', controller.generateCarrierSettlement)

// 导入承运商账单并对账
router.post('/carrier-settlements/import-bill', controller.importCarrierBill)

// 更新结算单
router.put('/carrier-settlements/:id', controller.updateCarrierSettlement)

// 确认结算（更新核对状态）
router.post('/carrier-settlements/:id/confirm', controller.confirmCarrierSettlement)

// 标记已付款
router.post('/carrier-settlements/:id/pay', controller.payCarrierSettlement)

// 获取结算明细
router.get('/carrier-settlements/:id/items', controller.getCarrierSettlementItems)

export default router

