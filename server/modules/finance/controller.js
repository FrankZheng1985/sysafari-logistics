/**
 * 财务管理模块 - 控制器
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { success, successWithPagination, badRequest, notFound, serverError } from '../../utils/response.js'
import * as model from './model.js'
import * as invoiceGenerator from './invoiceGenerator.js'
import { getBOCExchangeRate } from '../../utils/exchangeRate.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ==================== 发票管理 ====================

/**
 * 获取发票列表
 */
export async function getInvoices(req, res) {
  try {
    const { type, status, customerId, billId, startDate, endDate, search, page, pageSize } = req.query
    
    const result = await model.getInvoices({
      type,
      status,
      customerId,
      billId,
      startDate,
      endDate,
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取发票列表失败:', error)
    return serverError(res, '获取发票列表失败')
  }
}

/**
 * 获取发票统计
 */
export async function getInvoiceStats(req, res) {
  try {
    const { startDate, endDate } = req.query
    const stats = await model.getInvoiceStats({ startDate, endDate })
    return success(res, stats)
  } catch (error) {
    console.error('获取发票统计失败:', error)
    return serverError(res, '获取发票统计失败')
  }
}

/**
 * 获取汇率
 */
export async function getExchangeRate(req, res) {
  try {
    const { from = 'EUR', to = 'CNY' } = req.query
    const rate = await getBOCExchangeRate(from, to)
    return success(res, {
      from,
      to,
      rate,
      date: new Date().toISOString().split('T')[0]
    })
  } catch (error) {
    console.error('获取汇率失败:', error)
    return serverError(res, '获取汇率失败')
  }
}

/**
 * 获取发票详情
 */
export async function getInvoiceById(req, res) {
  try {
    const invoice = await model.getInvoiceById(req.params.id)
    if (!invoice) {
      return notFound(res, '发票不存在')
    }
    
    // 获取关联付款记录
    const payments = await model.getPayments({ invoiceId: invoice.id })
    
    return success(res, {
      ...invoice,
      payments: payments.list
    })
  } catch (error) {
    console.error('获取发票详情失败:', error)
    return serverError(res, '获取发票详情失败')
  }
}

/**
 * 创建发票
 */
export async function createInvoice(req, res) {
  try {
    const { invoiceType, totalAmount, items } = req.body
    
    if (!totalAmount || totalAmount <= 0) {
      return badRequest(res, '发票金额必须大于0')
    }
    
    const result = await model.createInvoice({
      ...req.body,
      createdBy: req.user?.id
    })
    
    // 异步生成PDF和Excel文件（不阻塞响应）
    invoiceGenerator.generateFilesForNewInvoice(result.id, { items })
      .then(({ pdfUrl, excelUrl }) => {
        if (pdfUrl || excelUrl) {
          console.log(`发票 ${result.invoiceNumber} 文件生成成功: PDF=${!!pdfUrl}, Excel=${!!excelUrl}`)
        }
      })
      .catch(err => {
        console.error(`发票 ${result.invoiceNumber} 文件生成失败:`, err)
      })
    
    const newInvoice = await model.getInvoiceById(result.id)
    return success(res, newInvoice, '创建成功')
  } catch (error) {
    console.error('创建发票失败:', error)
    return serverError(res, '创建发票失败')
  }
}

/**
 * 更新发票
 */
export async function updateInvoice(req, res) {
  try {
    const { id } = req.params

    const existing = await model.getInvoiceById(id)
    if (!existing) {
      return notFound(res, '发票不存在')
    }

    // 已付款的发票不能修改
    if (existing.status === 'paid') {
      return badRequest(res, '已付款的发票不能修改')
    }

    const updated = await model.updateInvoice(id, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }

    // 更新后重新生成 PDF 和 Excel 文件
    try {
      console.log(`[发票更新] 正在重新生成发票文件: ${id}`)
      await invoiceGenerator.regenerateInvoiceFiles(id)
      console.log(`[发票更新] 发票文件重新生成成功`)
    } catch (genError) {
      console.error('[发票更新] 重新生成发票文件失败:', genError.message)
      // 不影响主流程，继续返回更新成功
    }

    const updatedInvoice = await model.getInvoiceById(id)
    return success(res, updatedInvoice, '更新成功')
  } catch (error) {
    console.error('更新发票失败:', error)
    return serverError(res, '更新发票失败')
  }
}

/**
 * 删除发票
 */
export async function deleteInvoice(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getInvoiceById(id)
    if (!existing) {
      return notFound(res, '发票不存在')
    }
    
    // 有付款记录的发票不能删除
    if (existing.paidAmount > 0) {
      return badRequest(res, '已有付款记录的发票不能删除')
    }
    
    model.deleteInvoice(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除发票失败:', error)
    return serverError(res, '删除发票失败')
  }
}

// ==================== 付款管理 ====================

/**
 * 获取付款记录列表
 */
export async function getPayments(req, res) {
  try {
    const { type, invoiceId, customerId, method, startDate, endDate, status, search, page, pageSize } = req.query
    
    const result = await model.getPayments({
      type,
      invoiceId,
      customerId,
      method,
      startDate,
      endDate,
      status,
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取付款记录失败:', error)
    return serverError(res, '获取付款记录失败')
  }
}

/**
 * 获取付款统计
 */
export async function getPaymentStats(req, res) {
  try {
    const { startDate, endDate } = req.query
    const stats = await model.getPaymentStats({ startDate, endDate })
    return success(res, stats)
  } catch (error) {
    console.error('获取付款统计失败:', error)
    return serverError(res, '获取付款统计失败')
  }
}

/**
 * 获取付款记录详情
 */
export async function getPaymentById(req, res) {
  try {
    const payment = await model.getPaymentById(req.params.id)
    if (!payment) {
      return notFound(res, '付款记录不存在')
    }
    return success(res, payment)
  } catch (error) {
    console.error('获取付款记录详情失败:', error)
    return serverError(res, '获取付款记录详情失败')
  }
}

/**
 * 创建付款记录
 */
export async function createPayment(req, res) {
  try {
    const { amount, paymentType } = req.body
    
    if (!amount || amount <= 0) {
      return badRequest(res, '付款金额必须大于0')
    }
    
    // 如果关联发票，检查发票是否存在
    if (req.body.invoiceId) {
      const invoice = await model.getInvoiceById(req.body.invoiceId)
      if (!invoice) {
        return badRequest(res, '关联的发票不存在')
      }
      
      // 检查是否超额付款
      const remainingAmount = invoice.totalAmount - invoice.paidAmount
      if (amount > remainingAmount) {
        return badRequest(res, `付款金额不能超过未付金额 ${remainingAmount}`)
      }
    }
    
    const result = await model.createPayment({
      ...req.body,
      createdBy: req.user?.id
    })
    
    const newPayment = await model.getPaymentById(result.id)
    return success(res, newPayment, '创建成功')
  } catch (error) {
    console.error('创建付款记录失败:', error)
    return serverError(res, '创建付款记录失败')
  }
}

/**
 * 更新付款记录
 */
export async function updatePayment(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getPaymentById(id)
    if (!existing) {
      return notFound(res, '付款记录不存在')
    }
    
    const updated = await model.updatePayment(id, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedPayment = await model.getPaymentById(id)
    return success(res, updatedPayment, '更新成功')
  } catch (error) {
    console.error('更新付款记录失败:', error)
    return serverError(res, '更新付款记录失败')
  }
}

/**
 * 删除付款记录
 */
export async function deletePayment(req, res) {
  try {
    const { id } = req.params

    const existing = await model.getPaymentById(id)
    if (!existing) {
      return notFound(res, '付款记录不存在')
    }

    model.deletePayment(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除付款记录失败:', error)
    return serverError(res, '删除付款记录失败')
  }
}

/**
 * 上传付款凭证
 * 自动存储到COS并记录到文档管理系统
 */
export async function uploadPaymentReceipt(req, res) {
  try {
    const { id } = req.params
    const file = req.file

    if (!file) {
      return badRequest(res, '请选择要上传的文件')
    }

    // 获取付款记录
    const payment = await model.getPaymentById(id)
    if (!payment) {
      return notFound(res, '付款记录不存在')
    }

    // 动态导入文档服务
    const documentService = await import('../../../services/documentService.js')
    
    let fileBuffer = file.buffer
    let originalFilename = file.originalname
    
    // 如果是图片，进行压缩
    if (file.mimetype.startsWith('image/')) {
      try {
        const sharp = (await import('sharp')).default
        fileBuffer = await sharp(file.buffer)
          .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer()
        // 统一改为 jpg 扩展名
        originalFilename = originalFilename.replace(/\.(png|gif|webp)$/i, '.jpg')
      } catch (err) {
        console.warn('图片压缩失败，使用原图:', err.message)
      }
    }

    // 使用统一文档服务上传（自动存到COS + documents表）
    const docResult = await documentService.uploadPaymentReceipt({
      fileBuffer,
      fileName: originalFilename,
      paymentNumber: payment.paymentNumber,
      billId: payment.billId,
      billNumber: payment.billNumber,
      customerId: payment.customerId,
      customerName: payment.customerName,
      user: req.user
    })

    // 更新付款记录的凭证 URL
    await model.updatePayment(id, { receiptUrl: docResult.cosUrl })

    return success(res, { 
      receiptUrl: docResult.cosUrl,
      documentId: docResult.documentId,
      documentNumber: docResult.documentNumber
    }, '上传成功，已同步到文档管理')
  } catch (error) {
    console.error('上传付款凭证失败:', error)
    return serverError(res, error.message || '上传付款凭证失败')
  }
}

/**
 * 查看付款凭证
 */
export async function viewPaymentReceipt(req, res) {
  try {
    const { id } = req.params

    const payment = await model.getPaymentById(id)
    if (!payment) {
      return notFound(res, '付款记录不存在')
    }

    if (!payment.receiptUrl) {
      return notFound(res, '该付款记录没有上传凭证')
    }

    // 如果是 COS 存储的 URL，生成临时访问链接
    if (payment.receiptUrl.includes('.cos.')) {
      const cosStorage = await import('./cosStorage.js')
      const key = cosStorage.extractKeyFromUrl(payment.receiptUrl)
      if (key) {
        const signedUrl = await cosStorage.getSignedUrl(key, 7200) // 2小时有效期
        return success(res, { url: signedUrl })
      }
    }

    return success(res, { url: payment.receiptUrl })
  } catch (error) {
    console.error('获取付款凭证失败:', error)
    return serverError(res, '获取付款凭证失败')
  }
}

// ==================== 费用管理 ====================

/**
 * 获取费用列表
 */
export async function getFees(req, res) {
  try {
    const { category, billId, customerId, feeType, startDate, endDate, search, page, pageSize } = req.query
    
    const result = await model.getFees({
      category,
      billId,
      customerId,
      feeType,
      startDate,
      endDate,
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取费用列表失败:', error)
    return serverError(res, '获取费用列表失败')
  }
}

/**
 * 获取费用统计
 */
export async function getFeeStats(req, res) {
  try {
    const { billId, startDate, endDate } = req.query
    const stats = await model.getFeeStats({ billId, startDate, endDate })
    return success(res, stats)
  } catch (error) {
    console.error('获取费用统计失败:', error)
    return serverError(res, '获取费用统计失败')
  }
}

/**
 * 获取费用详情
 */
export async function getFeeById(req, res) {
  try {
    const fee = await model.getFeeById(req.params.id)
    if (!fee) {
      return notFound(res, '费用记录不存在')
    }
    return success(res, fee)
  } catch (error) {
    console.error('获取费用详情失败:', error)
    return serverError(res, '获取费用详情失败')
  }
}

/**
 * 创建费用
 */
export async function createFee(req, res) {
  try {
    const { feeName, amount } = req.body
    
    if (!feeName) {
      return badRequest(res, '费用名称为必填项')
    }
    
    if (!amount || amount <= 0) {
      return badRequest(res, '费用金额必须大于0')
    }
    
    const result = await model.createFee({
      ...req.body,
      createdBy: req.user?.id
    })
    
    const newFee = await model.getFeeById(result.id)
    return success(res, newFee, '创建成功')
  } catch (error) {
    console.error('创建费用失败:', error)
    return serverError(res, '创建费用失败')
  }
}

/**
 * 更新费用
 */
export async function updateFee(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getFeeById(id)
    if (!existing) {
      return notFound(res, '费用记录不存在')
    }
    
    const updated = await model.updateFee(id, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedFee = await model.getFeeById(id)
    return success(res, updatedFee, '更新成功')
  } catch (error) {
    console.error('更新费用失败:', error)
    return serverError(res, '更新费用失败')
  }
}

/**
 * 删除费用
 */
export async function deleteFee(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getFeeById(id)
    if (!existing) {
      return notFound(res, '费用记录不存在')
    }
    
    model.deleteFee(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除费用失败:', error)
    return serverError(res, '删除费用失败')
  }
}

// ==================== 提单财务 ====================

/**
 * 获取提单财务汇总
 */
export async function getBillFinanceSummary(req, res) {
  try {
    const { billId } = req.params
    
    const summary = await model.getBillFinanceSummary(billId)
    return success(res, summary)
  } catch (error) {
    console.error('获取提单财务汇总失败:', error)
    return serverError(res, '获取提单财务汇总失败')
  }
}

// ==================== 财务报表 ====================

/**
 * 获取财务概览
 */
export async function getFinanceOverview(req, res) {
  try {
    const { startDate, endDate } = req.query
    
    const invoiceStats = await model.getInvoiceStats({ startDate, endDate })
    const paymentStats = await model.getPaymentStats({ startDate, endDate })
    const feeStats = await model.getFeeStats({ startDate, endDate })
    
    // 获取当月营业收入
    const now = new Date()
    const currentMonth = now.getMonth() + 1 // 1-12
    const currentYear = now.getFullYear()
    const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
    const monthEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`
    
    const monthlyStats = await model.getPaymentStats({ startDate: monthStart, endDate: monthEnd })
    
    return success(res, {
      invoices: invoiceStats,
      payments: paymentStats,
      fees: feeStats,
      summary: {
        receivable: invoiceStats.balance.receivable,
        payable: invoiceStats.balance.payable,
        netCashFlow: paymentStats.netCashFlow,
        totalFees: feeStats.totalAmount,
        monthlyIncome: monthlyStats.income?.total || 0,
        currentMonth: currentMonth
      }
    })
  } catch (error) {
    console.error('获取财务概览失败:', error)
    return serverError(res, '获取财务概览失败')
  }
}

/**
 * 获取订单维度费用报表
 */
export async function getOrderFeeReport(req, res) {
  try {
    const { startDate, endDate, page, pageSize } = req.query
    
    const result = await model.getOrderFeeReport({
      startDate,
      endDate,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return success(res, result)
  } catch (error) {
    console.error('获取订单费用报表失败:', error)
    return serverError(res, '获取订单费用报表失败')
  }
}

/**
 * 获取客户维度费用报表
 */
export async function getCustomerFeeReport(req, res) {
  try {
    const { startDate, endDate, page, pageSize } = req.query
    
    const result = await model.getCustomerFeeReport({
      startDate,
      endDate,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return success(res, result)
  } catch (error) {
    console.error('获取客户费用报表失败:', error)
    return serverError(res, '获取客户费用报表失败')
  }
}

// ==================== 发票生成和下载 ====================

/**
 * 从费用记录生成发票
 */
export async function generateInvoiceFromFees(req, res) {
  try {
    const { feeIds, customerId } = req.body
    
    if (!feeIds || !Array.isArray(feeIds) || feeIds.length === 0) {
      return badRequest(res, '请选择要生成发票的费用记录')
    }
    
    const result = await invoiceGenerator.createInvoiceWithFiles(feeIds, customerId)
    
    return success(res, result, '发票生成成功')
  } catch (error) {
    console.error('生成发票失败:', error)
    return serverError(res, error.message || '生成发票失败')
  }
}

/**
 * 下载发票PDF
 */
export async function downloadInvoicePDF(req, res) {
  try {
    const { id } = req.params

    const downloadUrl = await invoiceGenerator.getInvoiceDownloadUrl(id, 'pdf')

    // 如果是本地文件，直接从本地读取返回
    if (downloadUrl.startsWith('/api/invoices/files/')) {
      const filename = downloadUrl.replace('/api/invoices/files/', '')
      req.params.filename = filename
      return downloadLocalInvoiceFile(req, res)
    }

    // 重定向到下载URL（COS等外部存储）
    return res.redirect(downloadUrl)
  } catch (error) {
    console.error('下载发票PDF失败:', error)
    return serverError(res, error.message || '下载失败')
  }
}

/**
 * 下载发票Excel对账单
 */
export async function downloadInvoiceExcel(req, res) {
  try {
    const { id } = req.params

    const downloadUrl = await invoiceGenerator.getInvoiceDownloadUrl(id, 'excel')

    // 如果是本地文件，直接从本地读取返回
    if (downloadUrl.startsWith('/api/invoices/files/')) {
      const filename = downloadUrl.replace('/api/invoices/files/', '')
      req.params.filename = filename
      return downloadLocalInvoiceFile(req, res)
    }

    // 重定向到下载URL（COS等外部存储）
    return res.redirect(downloadUrl)
  } catch (error) {
    console.error('下载发票Excel失败:', error)
    return serverError(res, error.message || '下载失败')
  }
}

/**
 * 下载本地存储的发票文件
 */
export async function downloadLocalInvoiceFile(req, res) {
  try {
    const { filename } = req.params
    
    // 安全检查：防止目录遍历攻击
    if (filename.includes('..') || filename.includes('/')) {
      return badRequest(res, '无效的文件名')
    }
    
    const fs = await import('fs')
    const path = await import('path')
    const { fileURLToPath } = await import('url')
    
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const filePath = path.join(__dirname, '../../uploads/invoices', filename)
    
    if (!fs.existsSync(filePath)) {
      return notFound(res, '文件不存在')
    }
    
    // 设置响应头
    const ext = path.extname(filename).toLowerCase()
    let contentType = 'application/octet-stream'
    if (ext === '.pdf') {
      contentType = 'application/pdf'
    } else if (ext === '.xlsx') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
    
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)
  } catch (error) {
    console.error('下载本地文件失败:', error)
    return serverError(res, '下载失败')
  }
}

/**
 * 重新生成发票文件
 */
export async function regenerateInvoice(req, res) {
  try {
    const { id } = req.params
    
    const result = await invoiceGenerator.regenerateInvoiceFiles(id)
    
    return success(res, result, '发票文件重新生成成功')
  } catch (error) {
    console.error('重新生成发票失败:', error)
    return serverError(res, error.message || '重新生成失败')
  }
}

/**
 * 检查COS存储配置状态
 */
export async function checkCosStatus(req, res) {
  try {
    const { checkCosConfig } = await import('./cosStorage.js')
    const config = checkCosConfig()
    return success(res, {
      available: config.configured,
      message: config.configured ? 'COS存储已配置' : 'COS存储未配置',
      details: {
        hasSecretId: config.hasSecretId,
        hasSecretKey: config.hasSecretKey,
        hasBucket: config.hasBucket,
        region: config.region
      }
    })
  } catch (error) {
    console.error('检查COS状态失败:', error)
    return serverError(res, '检查COS状态失败')
  }
}

// ==================== 银行账户管理 ====================

/**
 * 获取银行账户列表
 */
export async function getBankAccounts(req, res) {
  try {
    const { isActive, currency } = req.query
    const accounts = await model.getBankAccounts({
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      currency
    })
    return success(res, accounts)
  } catch (error) {
    console.error('获取银行账户失败:', error)
    return serverError(res, '获取银行账户失败')
  }
}

/**
 * 获取单个银行账户
 */
export async function getBankAccountById(req, res) {
  try {
    const account = await model.getBankAccountById(req.params.id)
    if (!account) {
      return notFound(res, '银行账户不存在')
    }
    return success(res, account)
  } catch (error) {
    console.error('获取银行账户失败:', error)
    return serverError(res, '获取银行账户失败')
  }
}

/**
 * 创建银行账户
 */
export async function createBankAccount(req, res) {
  try {
    const { accountName, accountNumber, bankName } = req.body
    
    if (!accountName || !accountNumber || !bankName) {
      return badRequest(res, '账户名称、账号和银行名称为必填项')
    }
    
    const result = await model.createBankAccount(req.body)
    const account = await model.getBankAccountById(result.id)
    return success(res, account, '创建成功')
  } catch (error) {
    console.error('创建银行账户失败:', error)
    return serverError(res, '创建银行账户失败')
  }
}

/**
 * 更新银行账户
 */
export async function updateBankAccount(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getBankAccountById(id)
    if (!existing) {
      return notFound(res, '银行账户不存在')
    }
    
    const updated = await model.updateBankAccount(id, req.body)
    return success(res, updated, '更新成功')
  } catch (error) {
    console.error('更新银行账户失败:', error)
    return serverError(res, '更新银行账户失败')
  }
}

/**
 * 删除银行账户
 */
export async function deleteBankAccount(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getBankAccountById(id)
    if (!existing) {
      return notFound(res, '银行账户不存在')
    }
    
    await model.deleteBankAccount(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除银行账户失败:', error)
    return serverError(res, '删除银行账户失败')
  }
}

// ==================== 财务报表 ====================

/**
 * 获取资产负债表
 */
export async function getBalanceSheet(req, res) {
  try {
    const { asOfDate } = req.query
    const date = asOfDate || new Date().toISOString().split('T')[0]
    
    const data = await model.getBalanceSheet(date)
    return success(res, data)
  } catch (error) {
    console.error('获取资产负债表失败:', error)
    return serverError(res, '获取资产负债表失败')
  }
}

/**
 * 获取利润表
 */
export async function getIncomeStatement(req, res) {
  try {
    const { startDate, endDate } = req.query
    
    if (!startDate || !endDate) {
      return badRequest(res, '请提供开始日期和结束日期')
    }
    
    const data = await model.getIncomeStatement(startDate, endDate)
    return success(res, data)
  } catch (error) {
    console.error('获取利润表失败:', error)
    return serverError(res, '获取利润表失败')
  }
}

/**
 * 获取现金流量表
 */
export async function getCashFlowStatement(req, res) {
  try {
    const { startDate, endDate } = req.query
    
    if (!startDate || !endDate) {
      return badRequest(res, '请提供开始日期和结束日期')
    }
    
    const data = await model.getCashFlowStatement(startDate, endDate)
    return success(res, data)
  } catch (error) {
    console.error('获取现金流量表失败:', error)
    return serverError(res, '获取现金流量表失败')
  }
}

/**
 * 获取经营分析表
 */
export async function getBusinessAnalysis(req, res) {
  try {
    const { startDate, endDate } = req.query
    
    if (!startDate || !endDate) {
      return badRequest(res, '请提供开始日期和结束日期')
    }
    
    const data = await model.getBusinessAnalysis(startDate, endDate)
    return success(res, data)
  } catch (error) {
    console.error('获取经营分析表失败:', error)
    return serverError(res, '获取经营分析表失败')
  }
}

/**
 * 生成并保存财务报表 PDF
 */
export async function generateFinancialReport(req, res) {
  try {
    const { type } = req.params
    const { startDate, endDate, asOfDate, createdBy, createdByName } = req.body
    
    // 验证报表类型
    const validTypes = ['balance_sheet', 'income_statement', 'cash_flow', 'business_analysis']
    if (!validTypes.includes(type)) {
      return badRequest(res, '无效的报表类型')
    }
    
    // 获取报表数据
    let reportData
    let periodStart = null
    let periodEnd = null
    let reportAsOfDate = null
    
    if (type === 'balance_sheet') {
      reportAsOfDate = asOfDate || new Date().toISOString().split('T')[0]
      reportData = await model.getBalanceSheet(reportAsOfDate)
    } else {
      if (!startDate || !endDate) {
        return badRequest(res, '请提供开始日期和结束日期')
      }
      periodStart = startDate
      periodEnd = endDate
      
      if (type === 'income_statement') {
        reportData = await model.getIncomeStatement(startDate, endDate)
      } else if (type === 'cash_flow') {
        reportData = await model.getCashFlowStatement(startDate, endDate)
      } else if (type === 'business_analysis') {
        reportData = await model.getBusinessAnalysis(startDate, endDate)
      }
    }
    
    // 生成并上传 PDF
    const { generateAndUploadReport, REPORT_NAMES } = await import('./financialReportPdf.js')
    const result = await generateAndUploadReport(type, reportData, { createdBy, createdByName })
    
    // 保存报表记录到数据库
    const saveResult = await model.saveFinancialReport({
      reportType: type,
      reportName: REPORT_NAMES[type] || type,
      periodStart,
      periodEnd,
      asOfDate: reportAsOfDate,
      pdfUrl: result.pdfUrl,
      pdfKey: result.pdfKey,
      reportData,
      createdBy,
      createdByName
    })
    
    return success(res, {
      id: saveResult.id,
      reportType: type,
      reportName: REPORT_NAMES[type],
      pdfUrl: result.pdfUrl,
      filename: result.filename
    }, '报表生成成功')
  } catch (error) {
    console.error('生成财务报表失败:', error)
    return serverError(res, '生成财务报表失败: ' + error.message)
  }
}

/**
 * 获取财务报表历史列表
 */
export async function getFinancialReportHistory(req, res) {
  try {
    const { reportType, startDate, endDate, page, pageSize } = req.query
    
    const result = await model.getFinancialReports({
      reportType,
      startDate,
      endDate,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20
    })
    
    return success(res, result)
  } catch (error) {
    console.error('获取报表历史失败:', error)
    return serverError(res, '获取报表历史失败')
  }
}

/**
 * 获取单个财务报表详情
 */
export async function getFinancialReportById(req, res) {
  try {
    const { id } = req.params
    const report = await model.getFinancialReportById(id)
    
    if (!report) {
      return notFound(res, '报表不存在')
    }
    
    return success(res, report)
  } catch (error) {
    console.error('获取报表详情失败:', error)
    return serverError(res, '获取报表详情失败')
  }
}

/**
 * 下载报表 PDF（本地文件）
 */
export async function downloadReportFile(req, res) {
  try {
    const { filename } = req.params
    const filePath = path.join(__dirname, '../../uploads/reports', filename)
    
    if (!fs.existsSync(filePath)) {
      return notFound(res, '文件不存在')
    }
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)
  } catch (error) {
    console.error('下载报表失败:', error)
    return serverError(res, '下载报表失败')
  }
}

// ==================== 承运商结算 ====================

import * as carrierSettlement from './carrierSettlement.js'

/**
 * 获取结算单列表
 */
export async function getCarrierSettlements(req, res) {
  try {
    const { carrierId, reconcileStatus, paymentStatus, startDate, endDate, page, pageSize } = req.query
    
    const result = await carrierSettlement.getSettlements({
      carrierId: carrierId ? parseInt(carrierId) : null,
      reconcileStatus,
      paymentStatus,
      startDate,
      endDate,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return success(res, result)
  } catch (error) {
    console.error('获取结算单列表失败:', error)
    return serverError(res, '获取结算单列表失败')
  }
}

/**
 * 获取结算统计
 */
export async function getCarrierSettlementStats(req, res) {
  try {
    const { carrierId, year, month } = req.query
    
    const stats = await carrierSettlement.getSettlementStats({
      carrierId: carrierId ? parseInt(carrierId) : null,
      year: year ? parseInt(year) : null,
      month: month ? parseInt(month) : null
    })
    
    return success(res, stats)
  } catch (error) {
    console.error('获取结算统计失败:', error)
    return serverError(res, '获取结算统计失败')
  }
}

/**
 * 获取结算单详情
 */
export async function getCarrierSettlementById(req, res) {
  try {
    const { id } = req.params
    const settlement = await carrierSettlement.getSettlementById(id)
    
    if (!settlement) {
      return notFound(res, '结算单不存在')
    }
    
    return success(res, settlement)
  } catch (error) {
    console.error('获取结算单详情失败:', error)
    return serverError(res, '获取结算单详情失败')
  }
}

/**
 * 按周期生成结算单
 */
export async function generateCarrierSettlement(req, res) {
  try {
    const { carrierId, periodStart, periodEnd } = req.body
    
    if (!carrierId || !periodStart || !periodEnd) {
      return badRequest(res, '承运商ID、结算周期开始和结束日期为必填项')
    }
    
    const result = await carrierSettlement.generateSettlementByPeriod(
      parseInt(carrierId),
      periodStart,
      periodEnd
    )
    
    if (!result.success) {
      return badRequest(res, result.error)
    }
    
    return success(res, result.data, '结算单生成成功')
  } catch (error) {
    console.error('生成结算单失败:', error)
    return serverError(res, '生成结算单失败')
  }
}

/**
 * 导入承运商账单并对账
 */
export async function importCarrierBill(req, res) {
  try {
    const { carrierId, carrierName, periodStart, periodEnd, billItems, currency } = req.body
    
    if (!carrierId || !periodStart || !periodEnd || !billItems || !Array.isArray(billItems)) {
      return badRequest(res, '承运商ID、结算周期和账单明细为必填项')
    }
    
    const result = await carrierSettlement.importBillAndReconcile({
      carrierId: parseInt(carrierId),
      carrierName,
      periodStart,
      periodEnd,
      billItems,
      currency
    })
    
    if (!result.success) {
      return badRequest(res, result.error)
    }
    
    return success(res, result.data, '账单导入并对账完成')
  } catch (error) {
    console.error('导入账单失败:', error)
    return serverError(res, '导入账单失败')
  }
}

/**
 * 更新结算单
 */
export async function updateCarrierSettlement(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    const updated = await carrierSettlement.updateSettlement(id, data)
    
    if (!updated) {
      return notFound(res, '结算单不存在或无更新')
    }
    
    return success(res, null, '更新成功')
  } catch (error) {
    console.error('更新结算单失败:', error)
    return serverError(res, '更新结算单失败')
  }
}

/**
 * 确认结算（核对状态更新为confirmed）
 */
export async function confirmCarrierSettlement(req, res) {
  try {
    const { id } = req.params
    
    const updated = await carrierSettlement.updateSettlement(id, {
      reconcileStatus: 'confirmed'
    })
    
    if (!updated) {
      return notFound(res, '结算单不存在')
    }
    
    return success(res, null, '结算已确认')
  } catch (error) {
    console.error('确认结算失败:', error)
    return serverError(res, '确认结算失败')
  }
}

/**
 * 标记已付款
 */
export async function payCarrierSettlement(req, res) {
  try {
    const { id } = req.params
    const { paidAmount } = req.body
    
    const settlement = await carrierSettlement.getSettlementById(id)
    if (!settlement) {
      return notFound(res, '结算单不存在')
    }
    
    const updated = await carrierSettlement.updateSettlement(id, {
      paymentStatus: 'paid',
      paidAmount: paidAmount || settlement.carrierBillAmount
    })
    
    if (!updated) {
      return badRequest(res, '更新失败')
    }
    
    return success(res, null, '已标记为已付款')
  } catch (error) {
    console.error('标记付款失败:', error)
    return serverError(res, '标记付款失败')
  }
}

/**
 * 获取结算明细
 */
export async function getCarrierSettlementItems(req, res) {
  try {
    const { id } = req.params
    
    const items = await carrierSettlement.getSettlementItems(id)
    
    return success(res, items)
  } catch (error) {
    console.error('获取结算明细失败:', error)
    return serverError(res, '获取结算明细失败')
  }
}

