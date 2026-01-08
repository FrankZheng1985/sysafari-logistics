/**
 * CRM客户关系管理模块 - 路由定义
 */

import express from 'express'
import multer from 'multer'
import * as controller from './controller.js'
import * as portalController from '../portal-api/controller.js'
import { authenticate } from '../../middleware/auth.js'

const router = express.Router()

// 配置合同文件上传
const contractUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的文件类型，请上传 PDF、Word 或图片文件'))
    }
  }
})

// ==================== 客户管理路由 ====================

// 获取客户统计
router.get('/customers/stats', controller.getCustomerStats)

// 获取客户列表
router.get('/customers', controller.getCustomers)

// 获取客户详情
router.get('/customers/:id', controller.getCustomerById)

// 创建客户
router.post('/customers', controller.createCustomer)

// 更新客户
router.put('/customers/:id', controller.updateCustomer)

// 删除客户
router.delete('/customers/:id', controller.deleteCustomer)

// 更新客户状态
router.put('/customers/:id/status', controller.updateCustomerStatus)

// 分配客户给业务员
router.put('/customers/:id/assign', controller.assignCustomer)

// ==================== 联系人管理路由 ====================

// 获取客户联系人列表
router.get('/customers/:customerId/contacts', controller.getContacts)

// 获取联系人详情
router.get('/customers/:customerId/contacts/:contactId', controller.getContactById)

// 创建联系人
router.post('/customers/:customerId/contacts', controller.createContact)

// 更新联系人
router.put('/customers/:customerId/contacts/:contactId', controller.updateContact)

// 删除联系人
router.delete('/customers/:customerId/contacts/:contactId', controller.deleteContact)

// ==================== 跟进记录路由 ====================

// 获取所有跟进记录（支持筛选）
router.get('/follow-ups', controller.getFollowUps)

// 获取客户跟进记录
router.get('/customers/:customerId/follow-ups', controller.getCustomerFollowUps)

// 创建跟进记录
router.post('/customers/:customerId/follow-ups', controller.createFollowUp)

// 更新跟进记录
router.put('/follow-ups/:followUpId', controller.updateFollowUp)

// 删除跟进记录
router.delete('/follow-ups/:followUpId', controller.deleteFollowUp)

// ==================== 客户订单路由 ====================

// 获取客户订单统计
router.get('/customers/:customerId/order-stats', controller.getCustomerOrderStats)

// 获取客户订单趋势统计（按月/年维度）
router.get('/customers/:customerId/order-trend', controller.getCustomerOrderTrend)

// 获取客户订单列表
router.get('/customers/:customerId/orders', controller.getCustomerOrders)

// ==================== 客户报价单PDF路由 ====================

// 获取客户最新报价单PDF
router.get('/customers/:customerId/quotation-pdf', controller.getCustomerQuotationPdf)

// 获取客户报价单历史列表
router.get('/customers/:customerId/quotation-history', controller.getCustomerQuotationHistory)

// ==================== 客户地址路由 ====================

// 获取客户地址列表
router.get('/customers/:customerId/addresses', controller.getCustomerAddresses)

// 创建客户地址
router.post('/customers/:customerId/addresses', controller.createCustomerAddress)

// 更新客户地址
router.put('/customers/:customerId/addresses/:addressId', controller.updateCustomerAddress)

// 删除客户地址
router.delete('/customers/:customerId/addresses/:addressId', controller.deleteCustomerAddress)

// ==================== 客户税号路由 ====================

// 获取客户税号列表
router.get('/customers/:customerId/tax-numbers', controller.getCustomerTaxNumbers)

// 创建客户税号
router.post('/customers/:customerId/tax-numbers', controller.createCustomerTaxNumber)

// 更新客户税号
router.put('/customers/:customerId/tax-numbers/:taxId', controller.updateCustomerTaxNumber)

// 删除客户税号
router.delete('/customers/:customerId/tax-numbers/:taxId', controller.deleteCustomerTaxNumber)

// ==================== 税号验证路由 ====================

// VAT税号验证
router.post('/tax/validate-vat', controller.validateVAT)

// EORI号码验证
router.post('/tax/validate-eori', controller.validateEORI)

// 获取支持的VAT国家列表
router.get('/tax/supported-countries', controller.getSupportedVatCountries)

// ==================== 销售机会路由 ====================

// 获取销售机会统计
router.get('/opportunities/stats', controller.getOpportunityStats)

// 获取销售机会列表
router.get('/opportunities', controller.getOpportunities)

// 获取销售机会详情
router.get('/opportunities/:id', controller.getOpportunityById)

// 创建销售机会
router.post('/opportunities', controller.createOpportunity)

// 更新销售机会
router.put('/opportunities/:id', controller.updateOpportunity)

// 更新销售机会阶段
router.put('/opportunities/:id/stage', controller.updateOpportunityStage)

// 删除销售机会
router.delete('/opportunities/:id', controller.deleteOpportunity)

// ==================== 报价管理路由 ====================

// 获取报价列表
router.get('/quotations', controller.getQuotations)

// 获取报价详情
router.get('/quotations/:id', controller.getQuotationById)

// 创建报价
router.post('/quotations', controller.createQuotation)

// 更新报价
router.put('/quotations/:id', controller.updateQuotation)

// 删除报价
router.delete('/quotations/:id', controller.deleteQuotation)

// 生成报价单PDF
router.post('/quotations/:id/pdf', controller.generateQuotationPdf)

// ==================== 报价费用项选择路由（用于新增费用） ====================

// 获取客户已确认的报价单（用于新增费用时选择）
router.get('/customers/:customerId/confirmed-quotations', controller.getCustomerConfirmedQuotations)

// ==================== 合同管理路由 ====================

// 获取合同列表
router.get('/contracts', controller.getContracts)

// 获取合同详情
router.get('/contracts/:id', controller.getContractById)

// 创建合同
router.post('/contracts', controller.createContract)

// 更新合同
router.put('/contracts/:id', controller.updateContract)

// 删除合同
router.delete('/contracts/:id', controller.deleteContract)

// ==================== 合同签署管理路由 ====================

// 为销售机会生成合同
router.post('/contracts/generate', controller.generateContract)

// 上传已签署合同（支持文件上传）
router.post('/contracts/:id/upload-signed', contractUpload.single('file'), controller.uploadSignedContract)

// 更新合同签署状态
router.put('/contracts/:id/sign-status', controller.updateContractSignStatus)

// 获取合同签署历史
router.get('/contracts/:id/sign-history', controller.getContractSignHistory)

// 获取客户待签署合同
router.get('/customers/:customerId/pending-contracts', controller.getPendingSignContracts)

// 检查销售机会是否可以成交
router.get('/opportunities/:opportunityId/can-close', controller.checkOpportunityCanClose)

// 销售机会成交（带合同校验）
router.put('/opportunities/:id/close', controller.closeOpportunity)

// ==================== 客户反馈/投诉路由 ====================

// 获取反馈统计
router.get('/feedbacks/stats', controller.getFeedbackStats)

// 获取反馈列表
router.get('/feedbacks', controller.getFeedbacks)

// 获取反馈详情
router.get('/feedbacks/:id', controller.getFeedbackById)

// 创建反馈
router.post('/feedbacks', controller.createFeedback)

// 更新反馈
router.put('/feedbacks/:id', controller.updateFeedback)

// 解决反馈
router.put('/feedbacks/:id/resolve', controller.resolveFeedback)

// 删除反馈
router.delete('/feedbacks/:id', controller.deleteFeedback)

// ==================== 客户分析路由 ====================

// 获取销售漏斗数据
router.get('/analytics/sales-funnel', controller.getSalesFunnel)

// 获取客户活跃度排行
router.get('/analytics/activity-ranking', controller.getCustomerActivityRanking)

// 获取客户价值分析
router.get('/customers/:customerId/value-analysis', controller.getCustomerValueAnalysis)

// ==================== 税号自动验证路由 ====================

// 手动触发批量验证所有税号
router.post('/tax/validate-all', controller.validateAllTaxNumbers)

// 获取税号验证统计
router.get('/tax/validation-stats', controller.getTaxValidationStats)

// ==================== 营业执照OCR识别路由 ====================

// 识别营业执照图片
router.post('/ocr/business-license', controller.recognizeBusinessLicense)

// 检查OCR服务状态
router.get('/ocr/status', controller.checkOcrStatus)

// ==================== 共享税号管理路由（公司级税号库） ====================

// 获取共享税号列表
router.get('/shared-tax-numbers', controller.getSharedTaxNumbers)

// 获取共享税号详情
router.get('/shared-tax-numbers/:id', controller.getSharedTaxNumberById)

// 创建共享税号
router.post('/shared-tax-numbers', controller.createSharedTaxNumber)

// 更新共享税号
router.put('/shared-tax-numbers/:id', controller.updateSharedTaxNumber)

// 删除共享税号
router.delete('/shared-tax-numbers/:id', controller.deleteSharedTaxNumber)

// ==================== 客户门户账户管理路由 ====================

// 获取客户门户账户列表
router.get('/customer-accounts', controller.getCustomerAccounts)

// 获取单个账户详情
router.get('/customer-accounts/:id', controller.getCustomerAccountById)

// 创建客户门户账户
router.post('/customer-accounts', controller.createCustomerAccount)

// 更新客户门户账户
router.put('/customer-accounts/:id', controller.updateCustomerAccount)

// 重置客户账户密码
router.put('/customer-accounts/:id/reset-password', controller.resetCustomerAccountPassword)

// 删除客户门户账户
router.delete('/customer-accounts/:id', controller.deleteCustomerAccount)

// 工作人员代登录客户门户（生成代登录Token）- 需要 ERP 系统认证
router.post('/customer-accounts/:accountId/staff-login', authenticate, portalController.staffProxyLogin)

// ==================== API 密钥管理路由 ====================

// 获取客户的 API 密钥列表
router.get('/customers/:customerId/api-keys', controller.getCustomerApiKeys)

// 创建 API 密钥
router.post('/customers/:customerId/api-keys', controller.createApiKey)

// 更新 API 密钥
router.put('/api-keys/:id', controller.updateApiKey)

// 删除 API 密钥
router.delete('/api-keys/:id', controller.deleteApiKey)

// 获取 API 调用日志
router.get('/api-call-logs', controller.getApiCallLogs)

// ==================== 最后里程费率集成路由 ====================

// 获取最后里程费率（用于报价单）
router.get('/last-mile-rate', controller.getLastMileRateForQuotation)

export default router

