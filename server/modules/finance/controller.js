/**
 * 财务管理模块 - 控制器
 */

import { success, successWithPagination, badRequest, notFound, serverError } from '../../utils/response.js'
import * as model from './model.js'

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
    const { invoiceType, totalAmount } = req.body
    
    if (!totalAmount || totalAmount <= 0) {
      return badRequest(res, '发票金额必须大于0')
    }
    
    const result = await model.createInvoice({
      ...req.body,
      createdBy: req.user?.id
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

// ==================== 费用管理 ====================

/**
 * 获取费用列表
 */
export async function getFees(req, res) {
  try {
    const { category, billId, customerId, startDate, endDate, search, page, pageSize } = req.query
    
    const result = await model.getFees({
      category,
      billId,
      customerId,
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

