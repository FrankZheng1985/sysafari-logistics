/**
 * 财务管理模块 - 控制器
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { success, successWithPagination, badRequest, notFound, serverError } from '../../utils/response.js'
import * as model from './model.js'
import * as orderModel from '../order/model.js'
import * as invoiceGenerator from './invoiceGenerator.js'
import * as messageModel from '../message/model.js'
import { getBOCExchangeRate } from '../../utils/exchangeRate.js'
import * as unifiedApprovalService from '../../services/unifiedApprovalService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ==================== 辅助函数 ====================

/**
 * 判断用户是否有财务权限
 * 财务权限判断逻辑：
 * 1. admin 角色始终有权限
 * 2. 用户拥有 finance:fee_manage 或 finance:manage 权限
 * 3. 用户拥有 finance:payment_approve 权限（财务审批权限）
 * 
 * 注意：财务角色应该在用户管理中配置，并分配相应的权限
 * 而不是硬编码角色名称
 */
function hasFinancePermission(user) {
  if (!user) return false
  
  const userRole = user.role
  const userPermissions = user.permissions || []
  
  // admin 角色始终有权限
  if (userRole === 'admin') {
    return true
  }
  
  // 检查财务相关权限
  const financePermissions = [
    'finance:fee_manage',      // 费用管理权限
    'finance:manage',          // 财务管理权限（通用）
    'finance:payment_approve'  // 财务审批权限
  ]
  
  return financePermissions.some(perm => userPermissions.includes(perm))
}

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
 * 导出发票列表为Excel
 */
export async function exportInvoices(req, res) {
  try {
    const { type, status, search, startDate, endDate } = req.query
    
    // 获取所有符合条件的发票（不分页）
    const result = await model.getInvoices({
      type,
      status,
      search,
      startDate,
      endDate,
      page: 1,
      pageSize: 10000  // 获取所有数据
    })
    
    const invoices = result.list || []
    
    // 动态导入 ExcelJS
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('发票列表')
    
    // 定义列
    worksheet.columns = [
      { header: '发票号', key: 'invoiceNumber', width: 20 },
      { header: '类型', key: 'invoiceType', width: 12 },
      { header: '客户/供应商', key: 'customerName', width: 20 },
      { header: '集装箱号/提单号', key: 'containerNumbers', width: 35 },
      { header: '金额', key: 'totalAmount', width: 15 },
      { header: '已付金额', key: 'paidAmount', width: 15 },
      { header: '未付金额', key: 'unpaidAmount', width: 15 },
      { header: '币种', key: 'currency', width: 8 },
      { header: '状态', key: 'status', width: 12 },
      { header: '发票日期', key: 'invoiceDate', width: 15 },
      { header: '到期日', key: 'dueDate', width: 15 },
      { header: '创建时间', key: 'createTime', width: 18 },
    ]
    
    // 设置表头样式
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }
    
    // 状态映射
    const statusMap = {
      draft: '草稿',
      pending: '待付款',
      partial: '部分付款',
      paid: '已付款',
      overdue: '已逾期',
      cancelled: '已取消'
    }
    
    // 类型映射
    const typeMap = {
      sales: '销售发票',
      purchase: '采购发票'
    }
    
    // 添加数据行
    invoices.forEach(invoice => {
      const totalAmount = Number(invoice.totalAmount) || 0
      const paidAmount = Number(invoice.paidAmount) || 0
      
      worksheet.addRow({
        invoiceNumber: invoice.invoiceNumber || '',
        invoiceType: typeMap[invoice.invoiceType] || invoice.invoiceType,
        customerName: invoice.customerName || '',
        containerNumbers: Array.isArray(invoice.containerNumbers) 
          ? invoice.containerNumbers.join(', ') 
          : (invoice.billNumber || ''),
        totalAmount: totalAmount.toFixed(2),
        paidAmount: paidAmount.toFixed(2),
        unpaidAmount: (totalAmount - paidAmount).toFixed(2),
        currency: invoice.currency || 'EUR',
        status: statusMap[invoice.status] || invoice.status,
        invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('zh-CN') : '',
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('zh-CN') : '',
        createTime: invoice.createTime ? new Date(invoice.createTime).toLocaleString('zh-CN') : '',
      })
    })
    
    // 设置响应头
    const fileName = `发票列表_${new Date().toISOString().slice(0, 10)}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
    
    // 写入响应
    await workbook.xlsx.write(res)
    res.end()
    
  } catch (error) {
    console.error('导出发票列表失败:', error)
    return serverError(res, '导出发票列表失败')
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
    
    // 检查是否需要重新获取费用明细
    // 条件：items 为空，或者 items 只有一个"服务费"，或者 items 缺少 containerNumber 字段
    let items = invoice.items
    const hasContainerNumber = Array.isArray(items) && items.length > 0 && items[0].containerNumber
    const needRefetchItems = !items || items.length === 0 || 
      (items.length === 1 && items[0].description === '服务费') ||
      !hasContainerNumber  // 如果缺少集装箱号，重新获取
    
    // 获取所有关联的订单信息（支持多个提单）
    let relatedBills = []
    if (invoice.billNumber) {
      // 解析多个提单号（逗号分隔）
      const billNumbers = invoice.billNumber.split(',').map(bn => bn.trim()).filter(Boolean)
      
      // 获取每个提单的详细信息（精确匹配提单号）
      for (const billNumber of billNumbers) {
        const bill = await orderModel.getBillByNumber(billNumber)
        if (bill) {
          relatedBills.push(bill)
        }
      }
    }
    
    if (needRefetchItems) {
      // 根据发票类型确定要筛选的费用类型
      // sales = 销售发票(应收) -> fee_type = 'receivable'
      // purchase = 采购发票(应付) -> fee_type = 'payable'
      const targetFeeType = invoice.invoiceType === 'purchase' ? 'payable' : 'receivable'
      
      // 从所有关联的 billId 获取费用
      let allFees = []
      if (relatedBills.length > 0) {
        for (const bill of relatedBills) {
          const fees = await model.getFees({ billId: bill.id, feeType: targetFeeType })
      if (fees && fees.list && fees.list.length > 0) {
            // 为每个费用添加集装箱号和提单号
        fees.list.forEach(fee => {
              allFees.push({
                ...fee,
                containerNumber: fee.containerNumber || bill.containerNumber,
                billNumber: fee.billNumber || bill.billNumber
              })
            })
          }
        }
      } else if (invoice.billId) {
        // 兼容旧逻辑：如果没有解析到多个提单，使用单个 billId
        const fees = await model.getFees({ billId: invoice.billId, feeType: targetFeeType })
        if (fees && fees.list) {
          allFees = fees.list
        }
      }
      
      if (allFees.length > 0) {
        // 原始费用明细（不合并，每个费用一行）
        items = allFees.map(fee => ({
          description: fee.feeName || 'Other',
          descriptionEn: fee.feeNameEn || null,
          quantity: 1,
          unitValue: parseFloat(fee.amount) || 0,
          amount: parseFloat(fee.amount) || 0,
          containerNumber: fee.containerNumber,
          billNumber: fee.billNumber
        }))
      }
    }
    
    return success(res, {
      ...invoice,
      items,
      relatedBills,  // 返回所有关联的订单信息
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
 * 支持多发票批量核销
 */
export async function createPayment(req, res) {
  try {
    const { amount, paymentType, invoiceIds, invoiceId } = req.body
    
    // 支持多发票核销
    const allInvoiceIds = invoiceIds && Array.isArray(invoiceIds) && invoiceIds.length > 0 
      ? invoiceIds 
      : (invoiceId ? [invoiceId] : [])
    
    // 检查所有发票是否存在
    for (const invId of allInvoiceIds) {
      const invoice = await model.getInvoiceById(invId)
      if (!invoice) {
        return badRequest(res, `关联的发票 ${invId} 不存在`)
      }
    }
    
    // 单张发票核销时检查金额
    if (allInvoiceIds.length === 1 && amount) {
      const invoice = await model.getInvoiceById(allInvoiceIds[0])
      const remaining = invoice.totalAmount - invoice.paidAmount
      if (amount > remaining) {
        return badRequest(res, `付款金额 ${amount} 超过发票未付金额 ${remaining.toFixed(2)}`)
      }
    }
    
    const result = await model.createPayment({
      ...req.body,
      invoiceIds: allInvoiceIds,
      createdBy: req.user?.id
    })
    
    // 批量核销返回批次信息
    if (result.batchId) {
      return success(res, {
        batchId: result.batchId,
        invoiceCount: result.invoiceCount,
        totalAmount: result.totalAmount,
        payments: result.payments
      }, `成功批量核销 ${result.invoiceCount} 张发票，总金额 ${result.totalAmount.toFixed(2)}`)
    }
    
    // 单张发票核销返回付款记录
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
    const { category, feeName, billId, customerId, supplierId, supplierName, feeType, startDate, endDate, search, excludeInvoiced, page, pageSize } = req.query
    
    const result = await model.getFees({
      category,
      feeName,         // 按费用名称筛选（从统计卡片点击时传入）
      billId,
      customerId,
      supplierId,      // 供应商ID过滤
      supplierName,    // 供应商名称过滤（用于兼容不同ID格式）
      feeType,
      startDate,
      endDate,
      search,
      excludeInvoiced, // 排除已开票的费用（创建发票时使用）
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      totalGroups: result.totalGroups,  // 用于前端分页计算
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
 * 支持追加费用逻辑：
 * - 如果提单已确认收款，标记为追加费用
 * - 非财务人员录入追加费用需要审批
 * - 财务人员录入追加费用直接生效
 */
export async function createFee(req, res) {
  try {
    const { feeName, amount, billId } = req.body
    const userId = req.user?.id
    const userName = req.user?.name || req.user?.username || 'system'
    
    if (!feeName) {
      return badRequest(res, '费用名称为必填项')
    }
    
    // 允许金额为 0（某些费用如 THC费是实报实销的）
    if (amount === undefined || amount === null || amount < 0) {
      return badRequest(res, '费用金额不能为负数')
    }
    
    // 准备费用数据
    const feeData = {
      ...req.body,
      createdBy: userId
    }
    
    // 检查提单是否已确认收款（追加费用逻辑）
    if (billId) {
      const isConfirmed = await model.isBillPaymentConfirmed(billId)
      
      if (isConfirmed) {
        // 标记为追加费用
        feeData.isSupplementary = 1
        feeData.approvalSubmittedAt = new Date().toISOString()
        feeData.approvalSubmittedBy = userId
        feeData.approvalSubmittedByName = userName
        
        // 判断是否有财务权限（基于用户管理中配置的权限）
        const isFinance = hasFinancePermission(req.user)
        
        // 调试日志
        console.log('[createFee] 追加费用权限检查:', {
          userId,
          userName,
          userRole: req.user?.role,
          permissions: (req.user?.permissions || []).filter(p => p.startsWith('finance:')),
          isFinance
        })
        
        if (isFinance) {
          // 财务人员：直接生效
          feeData.approvalStatus = 'approved'
          feeData.approvedAt = new Date().toISOString()
          feeData.approvedBy = userId
          feeData.approvedByName = userName
          console.log('[createFee] 财务人员创建，直接生效')
        } else {
          // 非财务人员：待审批
          feeData.approvalStatus = 'pending'
          console.log('[createFee] 非财务人员创建，需要审批')
        }
      }
    }
    
    const result = await model.createFee(feeData)
    
    // 如果需要审批，同时在统一审批表创建审批记录
    if (feeData.isSupplementary === 1 && feeData.approvalStatus === 'pending') {
      try {
        // 获取提单信息以获取集装箱号
        let containerNumber = ''
        if (billId) {
          const billInfo = await orderModel.getBillById(billId)
          containerNumber = billInfo?.containerNumber || ''
        }
        
        // 使用统一审批服务创建审批记录
        const approvalResult = await unifiedApprovalService.createApproval({
          operationCode: 'FEE_SUPPLEMENT',
          category: 'business',
          title: `追加费用审批 - ${feeName}`,
          content: `${userName} 在提单 ${req.body.billNumber || ''} 上追加了费用「${feeName}」，金额 ${amount} ${req.body.currency || 'EUR'}，请审批。`,
          businessId: result.id?.toString(),
          businessTable: 'fees',
          amount: amount,
          currency: req.body.currency || 'EUR',
          applicantId: userId,
          applicantName: userName,
          applicantRole: req.user?.role,
          requestData: { 
            fee: feeData, 
            billNumber: req.body.billNumber,
            containerNumber: containerNumber
          }
        })
        
        if (approvalResult.success) {
          console.log('[createFee] 已创建统一审批记录:', approvalResult.approval?.approval_no)
        } else {
          console.error('[createFee] 创建统一审批记录失败:', approvalResult.error)
        }
      } catch (approvalError) {
        console.error('[createFee] 创建审批记录异常:', approvalError)
        // 不阻断主流程
      }
    }
    
    const newFee = await model.getFeeById(result.id)
    
    // 返回不同的消息
    let message = '创建成功'
    if (feeData.isSupplementary === 1 && feeData.approvalStatus === 'pending') {
      message = '追加费用已提交审批'
    }
    
    return success(res, newFee, message)
  } catch (error) {
    console.error('创建费用失败:', error)
    return serverError(res, '创建费用失败')
  }
}

/**
 * 更新费用
 * 添加锁定检查：已锁定的费用不能修改
 */
export async function updateFee(req, res) {
  try {
    const { id } = req.params
    const userId = req.user?.id
    
    const existing = await model.getFeeById(id)
    if (!existing) {
      return notFound(res, '费用记录不存在')
    }
    
    // 检查费用是否已锁定
    if (existing.isLocked) {
      return badRequest(res, '该费用已锁定，无法修改')
    }
    
    // 检查待审批费用：只有提交人或财务可以修改
    if (existing.approvalStatus === 'pending') {
      const isFinance = hasFinancePermission(req.user)
      const isSubmitter = existing.approvalSubmittedBy == userId  // 宽松比较避免类型问题
      
      if (!isFinance && !isSubmitter) {
        return badRequest(res, '待审批费用仅提交人或财务可修改')
      }
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
 * 添加锁定检查：已锁定的费用不能删除
 */
export async function deleteFee(req, res) {
  try {
    const { id } = req.params
    const userId = req.user?.id
    const userRole = req.user?.role
    const userPermissions = req.user?.permissions || []
    
    const existing = await model.getFeeById(id)
    if (!existing) {
      return notFound(res, '费用记录不存在')
    }
    
    // 调试日志
    console.log('[deleteFee] 删除费用权限检查:', {
      feeId: id,
      userId,
      userRole,
      approvalStatus: existing.approvalStatus,
      approvalSubmittedBy: existing.approvalSubmittedBy,
      isLocked: existing.isLocked
    })
    
    // 检查费用是否已锁定
    if (existing.isLocked) {
      return badRequest(res, '该费用已锁定，无法删除')
    }
    
    // 检查待审批费用：只有提交人或财务可以删除
    if (existing.approvalStatus === 'pending') {
      const isFinance = hasFinancePermission(req.user)
      // 使用 == 进行宽松比较，避免类型不匹配问题
      const isSubmitter = existing.approvalSubmittedBy == userId
      
      console.log('[deleteFee] 权限判断结果:', {
        isFinance,
        isSubmitter,
        userRole,
        financePermissions: userPermissions.filter(p => p.startsWith('finance:'))
      })
      
      if (!isFinance && !isSubmitter) {
        return badRequest(res, '待审批费用仅提交人或财务可删除')
      }
    }
    
    await model.deleteFee(id)
    
    // 如果有关联的审批记录，也要删除
    try {
      const approval = await messageModel.getApprovalByBusinessId(id)
      if (approval) {
        await messageModel.processApproval(approval.id, {
          status: 'cancelled',
          approverId: userId,
          approverName: req.user?.name || 'system',
          remark: '费用已删除'
        })
      }
    } catch (approvalErr) {
      console.error('[deleteFee] 更新审批记录失败:', approvalErr)
    }
    
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

// ==================== 提单收款确认 ====================

/**
 * 确认提单收款
 * 1. 更新提单 payment_confirmed = 1
 * 2. 记录主发票号
 * 3. 锁定该提单所有已生效的费用
 */
export async function confirmBillPayment(req, res) {
  try {
    const { billId } = req.params
    const userId = req.user?.id
    const userName = req.user?.name || req.user?.username || 'system'
    
    // 1. 获取提单信息
    const bill = await orderModel.getBillById(billId)
    if (!bill) {
      return notFound(res, '提单不存在')
    }
    
    // 检查是否已确认
    if (bill.paymentConfirmed === 1) {
      return badRequest(res, '该提单收款已确认，无需重复确认')
    }
    
    // 2. 获取该提单的第一张发票号作为主发票号
    const invoices = await model.getInvoices({ 
      billId: billId,
      pageSize: 1 
    })
    const primaryInvoiceNumber = invoices.list?.[0]?.invoiceNumber || null
    
    // 3. 更新提单收款确认状态
    await model.confirmBillPayment(billId, {
      confirmedBy: userId,
      confirmedByName: userName,
      primaryInvoiceNumber
    })
    
    // 4. 锁定该提单所有已生效的费用（approval_status = 'approved'）
    const lockedCount = await model.lockBillFees(billId, userId)
    
    return success(res, {
      billId,
      primaryInvoiceNumber,
      lockedFeesCount: lockedCount
    }, '提单收款确认成功，已锁定相关费用')
  } catch (error) {
    console.error('确认提单收款失败:', error)
    return serverError(res, '确认提单收款失败')
  }
}

/**
 * 取消提单收款确认
 * 解锁费用，恢复可编辑状态
 */
export async function cancelBillPaymentConfirm(req, res) {
  try {
    const { billId } = req.params
    
    // 1. 获取提单信息
    const bill = await orderModel.getBillById(billId)
    if (!bill) {
      return notFound(res, '提单不存在')
    }
    
    // 检查是否已确认
    if (bill.paymentConfirmed !== 1) {
      return badRequest(res, '该提单收款未确认')
    }
    
    // 2. 取消确认状态
    await model.cancelBillPaymentConfirm(billId)
    
    // 3. 解锁费用
    const unlockedCount = await model.unlockBillFees(billId)
    
    return success(res, {
      billId,
      unlockedFeesCount: unlockedCount
    }, '已取消收款确认，费用已解锁')
  } catch (error) {
    console.error('取消提单收款确认失败:', error)
    return serverError(res, '取消提单收款确认失败')
  }
}

/**
 * 获取提单收款确认状态
 */
export async function getBillPaymentStatus(req, res) {
  try {
    const { billId } = req.params
    
    const bill = await orderModel.getBillById(billId)
    if (!bill) {
      return notFound(res, '提单不存在')
    }
    
    return success(res, {
      billId,
      paymentConfirmed: bill.paymentConfirmed === 1,
      paymentConfirmedAt: bill.paymentConfirmedAt,
      paymentConfirmedBy: bill.paymentConfirmedBy,
      paymentConfirmedByName: bill.paymentConfirmedByName,
      primaryInvoiceNumber: bill.primaryInvoiceNumber
    })
  } catch (error) {
    console.error('获取提单收款状态失败:', error)
    return serverError(res, '获取提单收款状态失败')
  }
}

// ==================== 追加费用审批 ====================

/**
 * 获取待审批的追加费用列表
 */
export async function getPendingApprovalFees(req, res) {
  try {
    const { page = 1, pageSize = 20, search } = req.query
    
    const result = await model.getPendingApprovalFees({
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      search
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取待审批费用列表失败:', error)
    return serverError(res, '获取待审批费用列表失败')
  }
}

/**
 * 审批通过追加费用
 */
export async function approveFee(req, res) {
  try {
    const { id } = req.params
    const userId = req.user?.id
    const userName = req.user?.name || req.user?.username || 'system'
    
    // 获取费用信息
    const fee = await model.getFeeById(id)
    if (!fee) {
      return notFound(res, '费用不存在')
    }
    
    if (fee.approvalStatus !== 'pending') {
      return badRequest(res, '该费用不在待审批状态')
    }
    
    // 更新费用表审批状态
    await model.approveFee(id, userId, userName)
    
    // 同时更新审批记录（兼容旧 approvals 表和新统一审批表）
    try {
      // 1. 更新旧 approvals 表（向后兼容）
      const approval = await messageModel.getApprovalByBusinessId(id)
      if (approval) {
        await messageModel.processApproval(approval.id, {
          status: 'approved',
          approverId: userId,
          approverName: userName,
          remark: '审批通过'
        })
      }
      
      // 2. 更新统一审批表
      const { getDatabase } = await import('../../config/database.js')
      const db = getDatabase()
      const unifiedApproval = await db.pool.query(
        `SELECT id FROM unified_approvals WHERE business_id = $1 AND business_table = 'fees' AND status = 'pending'`,
        [id.toString()]
      )
      if (unifiedApproval.rows.length > 0) {
        await unifiedApprovalService.approve(
          unifiedApproval.rows[0].id,
          userId,
          userName,
          req.user?.role,
          '审批通过'
        )
      }
    } catch (approvalErr) {
      console.error('[approveFee] 更新审批记录失败:', approvalErr)
      // 不阻断主流程
    }
    
    return success(res, { id }, '审批通过')
  } catch (error) {
    console.error('审批费用失败:', error)
    return serverError(res, '审批费用失败')
  }
}

/**
 * 审批拒绝追加费用
 */
export async function rejectFee(req, res) {
  try {
    const { id } = req.params
    const { reason } = req.body
    const userId = req.user?.id
    const userName = req.user?.name || req.user?.username || 'system'
    
    if (!reason) {
      return badRequest(res, '请填写拒绝原因')
    }
    
    // 获取费用信息
    const fee = await model.getFeeById(id)
    if (!fee) {
      return notFound(res, '费用不存在')
    }
    
    if (fee.approvalStatus !== 'pending') {
      return badRequest(res, '该费用不在待审批状态')
    }
    
    // 更新费用表审批状态
    await model.rejectFee(id, userId, userName, reason)
    
    // 同时更新审批记录（兼容旧 approvals 表和新统一审批表）
    try {
      // 1. 更新旧 approvals 表（向后兼容）
      const approval = await messageModel.getApprovalByBusinessId(id)
      if (approval) {
        await messageModel.processApproval(approval.id, {
          status: 'rejected',
          approverId: userId,
          approverName: userName,
          rejectReason: reason
        })
      }
      
      // 2. 更新统一审批表
      const { getDatabase } = await import('../../config/database.js')
      const db = getDatabase()
      const unifiedApproval = await db.pool.query(
        `SELECT id FROM unified_approvals WHERE business_id = $1 AND business_table = 'fees' AND status = 'pending'`,
        [id.toString()]
      )
      if (unifiedApproval.rows.length > 0) {
        await unifiedApprovalService.reject(
          unifiedApproval.rows[0].id,
          userId,
          userName,
          req.user?.role,
          reason
        )
      }
    } catch (approvalErr) {
      console.error('[rejectFee] 更新审批记录失败:', approvalErr)
      // 不阻断主流程
    }
    
    return success(res, { id }, '已拒绝')
  } catch (error) {
    console.error('拒绝费用失败:', error)
    return serverError(res, '拒绝费用失败')
  }
}

/**
 * 批量审批通过
 */
export async function batchApproveFees(req, res) {
  try {
    const { ids } = req.body
    const userId = req.user?.id
    const userName = req.user?.name || req.user?.username || 'system'
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return badRequest(res, '请选择要审批的费用')
    }
    
    let successCount = 0
    let failCount = 0
    
    for (const id of ids) {
      try {
        const fee = await model.getFeeById(id)
        if (fee && fee.approvalStatus === 'pending') {
          await model.approveFee(id, userId, userName)
          successCount++
        } else {
          failCount++
        }
      } catch (err) {
        failCount++
      }
    }
    
    return success(res, { successCount, failCount }, `批量审批完成：${successCount}条通过，${failCount}条失败`)
  } catch (error) {
    console.error('批量审批失败:', error)
    return serverError(res, '批量审批失败')
  }
}

// ==================== 追加发票 ====================

/**
 * 获取提单的主发票号
 */
export async function getBillPrimaryInvoiceNumber(req, res) {
  try {
    const { billId } = req.params
    
    const primaryInvoiceNumber = await model.getBillPrimaryInvoiceNumber(billId)
    
    if (!primaryInvoiceNumber) {
      return notFound(res, '该提单尚未确认收款或没有主发票')
    }
    
    return success(res, { billId, primaryInvoiceNumber })
  } catch (error) {
    console.error('获取主发票号失败:', error)
    return serverError(res, '获取主发票号失败')
  }
}

/**
 * 创建追加发票
 */
export async function createSupplementInvoice(req, res) {
  try {
    const { parentInvoiceNumber, billId } = req.body
    const userId = req.user?.id
    
    if (!parentInvoiceNumber) {
      return badRequest(res, '主发票号为必填项')
    }
    
    // 验证主发票是否存在
    const parentInvoice = await model.getInvoices({ search: parentInvoiceNumber, pageSize: 1 })
    if (!parentInvoice.list || parentInvoice.list.length === 0) {
      return notFound(res, '主发票不存在')
    }
    
    const result = await model.createSupplementInvoice({
      ...req.body,
      parentInvoiceNumber,
      createdBy: userId
    })
    
    const newInvoice = await model.getInvoiceById(result.id)
    return success(res, newInvoice, `追加发票创建成功：${result.invoiceNumber}`)
  } catch (error) {
    console.error('创建追加发票失败:', error)
    return serverError(res, '创建追加发票失败')
  }
}

/**
 * 获取提单的追加发票列表
 */
export async function getBillSupplementInvoices(req, res) {
  try {
    const { billId } = req.params
    
    // 先获取主发票号
    const primaryInvoiceNumber = await model.getBillPrimaryInvoiceNumber(billId)
    
    if (!primaryInvoiceNumber) {
      return success(res, { list: [], primaryInvoiceNumber: null })
    }
    
    // 获取所有追加发票
    const invoices = await model.getInvoices({ 
      search: primaryInvoiceNumber,
      pageSize: 100 
    })
    
    // 过滤出追加发票（parent_invoice_number = 主发票号）
    const supplementInvoices = invoices.list.filter(inv => 
      inv.parentInvoiceNumber === primaryInvoiceNumber
    )
    
    return success(res, { 
      list: supplementInvoices, 
      primaryInvoiceNumber,
      count: supplementInvoices.length
    })
  } catch (error) {
    console.error('获取追加发票列表失败:', error)
    return serverError(res, '获取追加发票列表失败')
  }
}

