/**
 * 财务管理模块 - 数据模型
 * 包含：发票管理、收付款跟踪、费用管理、财务统计
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== 常量定义 ====================

export const INVOICE_TYPE = {
  SALES: 'sales',           // 销售发票（应收）
  PURCHASE: 'purchase'      // 采购发票（应付）
}

export const INVOICE_STATUS = {
  DRAFT: 'draft',           // 草稿
  PENDING: 'pending',       // 待付款
  PARTIAL: 'partial',       // 部分付款
  PAID: 'paid',             // 已付款
  OVERDUE: 'overdue',       // 已逾期
  CANCELLED: 'cancelled'    // 已取消
}

export const PAYMENT_TYPE = {
  INCOME: 'income',         // 收款
  EXPENSE: 'expense'        // 付款
}

export const PAYMENT_METHOD = {
  BANK_TRANSFER: 'bank_transfer',   // 银行转账
  CASH: 'cash',                     // 现金
  CHECK: 'check',                   // 支票
  CREDIT_CARD: 'credit_card',       // 信用卡
  WECHAT: 'wechat',                 // 微信
  ALIPAY: 'alipay',                 // 支付宝
  OTHER: 'other'                    // 其他
}

export const FEE_CATEGORY = {
  FREIGHT: 'freight',               // 运费
  CUSTOMS: 'customs',               // 关税
  WAREHOUSE: 'warehouse',           // 仓储费
  INSURANCE: 'insurance',           // 保险费
  HANDLING: 'handling',             // 操作费
  DOCUMENTATION: 'documentation',   // 文件费
  OTHER: 'other'                    // 其他费用
}

// ==================== 发票管理 ====================

/**
 * 获取发票列表
 */
export async function getInvoices(params = {}) {
  const db = getDatabase()
  const { 
    type, status, customerId, billId,
    startDate, endDate, search,
    page = 1, pageSize = 20 
  } = params
  
  let query = 'SELECT * FROM invoices WHERE 1=1'
  const queryParams = []
  
  if (type) {
    query += ' AND invoice_type = ?'
    queryParams.push(type)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (customerId) {
    query += ' AND customer_id = ?'
    queryParams.push(customerId)
  }
  
  if (billId) {
    query += ' AND bill_id = ?'
    queryParams.push(billId)
  }
  
  if (startDate) {
    query += ' AND invoice_date >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND invoice_date <= ?'
    queryParams.push(endDate)
  }
  
  if (search) {
    query += ` AND (invoice_number LIKE ? OR customer_name LIKE ? OR description LIKE ?)`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY invoice_date DESC, created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertInvoiceToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 获取发票统计
 */
export async function getInvoiceStats(params = {}) {
  const db = getDatabase()
  const { startDate, endDate } = params
  
  let dateFilter = ''
  const queryParams = []
  
  if (startDate) {
    dateFilter += ' AND invoice_date >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    dateFilter += ' AND invoice_date <= ?'
    queryParams.push(endDate)
  }
  
  // 销售发票统计
  const salesStats = await db.prepare(`
    SELECT 
      COUNT(*) as total_count,
      COALESCE(SUM(total_amount), 0) as total_amount,
      COALESCE(SUM(paid_amount), 0) as paid_amount,
      COALESCE(SUM(total_amount - paid_amount), 0) as unpaid_amount,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
      SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count
    FROM invoices 
    WHERE invoice_type = 'sales' ${dateFilter}
  `).get(...queryParams)
  
  // 采购发票统计
  const purchaseStats = await db.prepare(`
    SELECT 
      COUNT(*) as total_count,
      COALESCE(SUM(total_amount), 0) as total_amount,
      COALESCE(SUM(paid_amount), 0) as paid_amount,
      COALESCE(SUM(total_amount - paid_amount), 0) as unpaid_amount,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
      SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count
    FROM invoices 
    WHERE invoice_type = 'purchase' ${dateFilter}
  `).get(...queryParams)
  
  return {
    sales: {
      totalCount: salesStats.total_count || 0,
      totalAmount: salesStats.total_amount || 0,
      paidAmount: salesStats.paid_amount || 0,
      unpaidAmount: salesStats.unpaid_amount || 0,
      pendingCount: salesStats.pending_count || 0,
      paidCount: salesStats.paid_count || 0,
      overdueCount: salesStats.overdue_count || 0
    },
    purchase: {
      totalCount: purchaseStats.total_count || 0,
      totalAmount: purchaseStats.total_amount || 0,
      paidAmount: purchaseStats.paid_amount || 0,
      unpaidAmount: purchaseStats.unpaid_amount || 0,
      pendingCount: purchaseStats.pending_count || 0,
      paidCount: purchaseStats.paid_count || 0,
      overdueCount: purchaseStats.overdue_count || 0
    },
    balance: {
      receivable: salesStats.unpaid_amount || 0,
      payable: purchaseStats.unpaid_amount || 0,
      net: (salesStats.unpaid_amount || 0) - (purchaseStats.unpaid_amount || 0)
    }
  }
}

/**
 * 根据ID获取发票
 */
export async function getInvoiceById(id) {
  const db = getDatabase()
  const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(id)
  return invoice ? convertInvoiceToCamelCase(invoice) : null
}

/**
 * 创建发票
 */
export async function createInvoice(data) {
  const db = getDatabase()
  const id = generateId()
  
  // 生成发票号
  const invoiceNumber = await generateInvoiceNumber(data.invoiceType)
  
  const result = await db.prepare(`
    INSERT INTO invoices (
      id, invoice_number, invoice_type, invoice_date, due_date,
      customer_id, customer_name, bill_id, bill_number,
      subtotal, tax_amount, total_amount, paid_amount,
      currency, exchange_rate, description, notes,
      status, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `).run(
    id,
    invoiceNumber,
    data.invoiceType || 'sales',
    data.invoiceDate || new Date().toISOString().split('T')[0],
    data.dueDate || null,
    data.customerId || null,
    data.customerName || '',
    data.billId || null,
    data.billNumber || '',
    data.subtotal || 0,
    data.taxAmount || 0,
    data.totalAmount || data.subtotal || 0,
    0, // paid_amount starts at 0
    data.currency || 'CNY',
    data.exchangeRate || 1,
    data.description || '',
    data.notes || '',
    data.status || 'pending',
    data.createdBy || null
  )
  
  return { id, invoiceNumber }
}

/**
 * 更新发票
 */
export async function updateInvoice(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    invoiceDate: 'invoice_date',
    dueDate: 'due_date',
    customerId: 'customer_id',
    customerName: 'customer_name',
    billId: 'bill_id',
    billNumber: 'bill_number',
    subtotal: 'subtotal',
    taxAmount: 'tax_amount',
    totalAmount: 'total_amount',
    currency: 'currency',
    exchangeRate: 'exchange_rate',
    description: 'description',
    notes: 'notes',
    status: 'status'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (fields.length === 0) return false
  
  fields.push('updated_at = datetime("now", "localtime")')
  values.push(id)
  
  const result = await db.prepare(`UPDATE invoices SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除发票
 */
export async function deleteInvoice(id) {
  const db = getDatabase()
  // 先删除关联的付款记录
  await db.prepare('DELETE FROM payments WHERE invoice_id = ?').run(id)
  // 再删除发票
  const result = await db.prepare('DELETE FROM invoices WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 更新发票已付金额
 */
export async function updateInvoicePaidAmount(id) {
  const db = getDatabase()
  
  // 计算总付款金额
  const result = await db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_paid 
    FROM payments WHERE invoice_id = ? AND status = 'completed'
  `).get(id)
  
  const paidAmount = result.total_paid
  
  // 获取发票总金额
  const invoice = await db.prepare('SELECT total_amount FROM invoices WHERE id = ?').get(id)
  if (!invoice) return false
  
  // 确定状态
  let status = 'pending'
  if (paidAmount >= invoice.total_amount) {
    status = 'paid'
  } else if (paidAmount > 0) {
    status = 'partial'
  }
  
  // 更新发票
  await db.prepare(`
    UPDATE invoices 
    SET paid_amount = ?, status = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(paidAmount, status, id)
  
  return true
}

// ==================== 付款管理 ====================

/**
 * 获取付款记录列表
 */
export async function getPayments(params = {}) {
  const db = getDatabase()
  const { 
    type, invoiceId, customerId, method,
    startDate, endDate, status, search,
    page = 1, pageSize = 20 
  } = params
  
  let query = 'SELECT * FROM payments WHERE 1=1'
  const queryParams = []
  
  if (type) {
    query += ' AND payment_type = ?'
    queryParams.push(type)
  }
  
  if (invoiceId) {
    query += ' AND invoice_id = ?'
    queryParams.push(invoiceId)
  }
  
  if (customerId) {
    query += ' AND customer_id = ?'
    queryParams.push(customerId)
  }
  
  if (method) {
    query += ' AND payment_method = ?'
    queryParams.push(method)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (startDate) {
    query += ' AND payment_date >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND payment_date <= ?'
    queryParams.push(endDate)
  }
  
  if (search) {
    query += ` AND (payment_number LIKE ? OR customer_name LIKE ? OR description LIKE ?)`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY payment_date DESC, created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertPaymentToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 获取付款统计
 */
export async function getPaymentStats(params = {}) {
  const db = getDatabase()
  const { startDate, endDate } = params
  
  let dateFilter = ''
  const queryParams = []
  
  if (startDate) {
    dateFilter += ' AND payment_date >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    dateFilter += ' AND payment_date <= ?'
    queryParams.push(endDate)
  }
  
  // 收款统计
  const incomeStats = await db.prepare(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as total
    FROM payments 
    WHERE payment_type = 'income' AND status = 'completed' ${dateFilter}
  `).get(...queryParams)
  
  // 付款统计
  const expenseStats = await db.prepare(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as total
    FROM payments 
    WHERE payment_type = 'expense' AND status = 'completed' ${dateFilter}
  `).get(...queryParams)
  
  return {
    income: {
      count: incomeStats.count || 0,
      total: incomeStats.total || 0
    },
    expense: {
      count: expenseStats.count || 0,
      total: expenseStats.total || 0
    },
    netCashFlow: (incomeStats.total || 0) - (expenseStats.total || 0)
  }
}

/**
 * 根据ID获取付款记录
 */
export async function getPaymentById(id) {
  const db = getDatabase()
  const payment = await db.prepare('SELECT * FROM payments WHERE id = ?').get(id)
  return payment ? convertPaymentToCamelCase(payment) : null
}

/**
 * 创建付款记录
 */
export async function createPayment(data) {
  const db = getDatabase()
  const id = generateId()
  
  // 生成付款单号
  const paymentNumber = await generatePaymentNumber(data.paymentType)
  
  const result = await db.prepare(`
    INSERT INTO payments (
      id, payment_number, payment_type, payment_date, payment_method,
      invoice_id, invoice_number, customer_id, customer_name,
      amount, currency, exchange_rate, bank_account, reference_number,
      description, notes, status, created_by,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `).run(
    id,
    paymentNumber,
    data.paymentType || 'income',
    data.paymentDate || new Date().toISOString().split('T')[0],
    data.paymentMethod || 'bank_transfer',
    data.invoiceId || null,
    data.invoiceNumber || '',
    data.customerId || null,
    data.customerName || '',
    data.amount,
    data.currency || 'CNY',
    data.exchangeRate || 1,
    data.bankAccount || '',
    data.referenceNumber || '',
    data.description || '',
    data.notes || '',
    data.status || 'completed',
    data.createdBy || null
  )
  
  // 如果关联发票，更新发票付款金额
  if (data.invoiceId && data.status === 'completed') {
    updateInvoicePaidAmount(data.invoiceId)
  }
  
  return { id, paymentNumber }
}

/**
 * 更新付款记录
 */
export async function updatePayment(id, data) {
  const db = getDatabase()
  
  // 获取原记录
  const original = getPaymentById(id)
  
  const fields = []
  const values = []
  
  const fieldMap = {
    paymentDate: 'payment_date',
    paymentMethod: 'payment_method',
    amount: 'amount',
    currency: 'currency',
    exchangeRate: 'exchange_rate',
    bankAccount: 'bank_account',
    referenceNumber: 'reference_number',
    description: 'description',
    notes: 'notes',
    status: 'status'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (fields.length === 0) return false
  
  fields.push('updated_at = datetime("now", "localtime")')
  values.push(id)
  
  const result = await db.prepare(`UPDATE payments SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  
  // 如果关联发票，更新发票付款金额
  if (original && original.invoiceId) {
    updateInvoicePaidAmount(original.invoiceId)
  }
  
  return result.changes > 0
}

/**
 * 删除付款记录
 */
export async function deletePayment(id) {
  const db = getDatabase()
  
  // 获取原记录
  const original = getPaymentById(id)
  
  const result = await db.prepare('DELETE FROM payments WHERE id = ?').run(id)
  
  // 如果关联发票，更新发票付款金额
  if (original && original.invoiceId) {
    updateInvoicePaidAmount(original.invoiceId)
  }
  
  return result.changes > 0
}

// ==================== 费用管理 ====================

/**
 * 获取费用列表
 */
export async function getFees(params = {}) {
  const db = getDatabase()
  const { 
    category, billId, customerId,
    startDate, endDate, search,
    page = 1, pageSize = 20 
  } = params
  
  let query = 'SELECT * FROM fees WHERE 1=1'
  const queryParams = []
  
  if (category) {
    query += ' AND category = ?'
    queryParams.push(category)
  }
  
  if (billId) {
    query += ' AND bill_id = ?'
    queryParams.push(billId)
  }
  
  if (customerId) {
    query += ' AND customer_id = ?'
    queryParams.push(customerId)
  }
  
  if (startDate) {
    query += ' AND fee_date >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND fee_date <= ?'
    queryParams.push(endDate)
  }
  
  if (search) {
    query += ` AND (fee_name LIKE ? OR description LIKE ?)`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY fee_date DESC, created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertFeeToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 获取费用统计（按类别）
 */
export async function getFeeStats(params = {}) {
  const db = getDatabase()
  const { billId, startDate, endDate } = params
  
  let whereClause = 'WHERE 1=1'
  const queryParams = []
  
  if (billId) {
    whereClause += ' AND bill_id = ?'
    queryParams.push(billId)
  }
  
  if (startDate) {
    whereClause += ' AND fee_date >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    whereClause += ' AND fee_date <= ?'
    queryParams.push(endDate)
  }
  
  const stats = await db.prepare(`
    SELECT 
      category,
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as total
    FROM fees 
    ${whereClause}
    GROUP BY category
  `).all(...queryParams)
  
  const totalAmount = stats.reduce((sum, s) => sum + s.total, 0)
  
  return {
    byCategory: stats.map(s => ({
      category: s.category,
      count: s.count,
      total: s.total
    })),
    totalAmount
  }
}

/**
 * 根据ID获取费用
 */
export async function getFeeById(id) {
  const db = getDatabase()
  const fee = await db.prepare('SELECT * FROM fees WHERE id = ?').get(id)
  return fee ? convertFeeToCamelCase(fee) : null
}

/**
 * 创建费用
 */
export async function createFee(data) {
  const db = getDatabase()
  const id = generateId()
  
  const result = await db.prepare(`
    INSERT INTO fees (
      id, bill_id, bill_number, customer_id, customer_name,
      category, fee_name, amount, currency, exchange_rate,
      fee_date, description, notes, created_by,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `).run(
    id,
    data.billId || null,
    data.billNumber || '',
    data.customerId || null,
    data.customerName || '',
    data.category || 'other',
    data.feeName,
    data.amount,
    data.currency || 'CNY',
    data.exchangeRate || 1,
    data.feeDate || new Date().toISOString().split('T')[0],
    data.description || '',
    data.notes || '',
    data.createdBy || null
  )
  
  return { id }
}

/**
 * 更新费用
 */
export async function updateFee(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    category: 'category',
    feeName: 'fee_name',
    amount: 'amount',
    currency: 'currency',
    exchangeRate: 'exchange_rate',
    feeDate: 'fee_date',
    description: 'description',
    notes: 'notes'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (fields.length === 0) return false
  
  fields.push('updated_at = datetime("now", "localtime")')
  values.push(id)
  
  const result = await db.prepare(`UPDATE fees SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除费用
 */
export async function deleteFee(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM fees WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 提单费用汇总 ====================

/**
 * 获取提单费用汇总
 */
export async function getBillFinanceSummary(billId) {
  const db = getDatabase()
  
  // 获取费用汇总
  const feeStats = getFeeStats({ billId })
  
  // 获取关联发票
  const invoices = await db.prepare(`
    SELECT * FROM invoices WHERE bill_id = ?
  `).all(billId).map(convertInvoiceToCamelCase)
  
  // 获取关联付款
  const payments = await db.prepare(`
    SELECT * FROM payments 
    WHERE invoice_id IN (SELECT id FROM invoices WHERE bill_id = ?)
  `).all(billId).map(convertPaymentToCamelCase)
  
  // 计算应收应付
  const salesInvoices = invoices.filter(i => i.invoiceType === 'sales')
  const purchaseInvoices = invoices.filter(i => i.invoiceType === 'purchase')
  
  const receivable = salesInvoices.reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0)
  const payable = purchaseInvoices.reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0)
  
  return {
    fees: feeStats,
    invoices: {
      sales: salesInvoices,
      purchase: purchaseInvoices
    },
    payments,
    summary: {
      totalFees: feeStats.totalAmount,
      receivable,
      payable,
      netBalance: receivable - payable
    }
  }
}

/**
 * 获取订单维度的费用统计报表
 * @param {Object} params - 查询参数
 * @returns {Object} 订单费用统计列表
 */
export async function getOrderFeeReport(params = {}) {
  const db = getDatabase()
  const { startDate, endDate, page = 1, pageSize = 20 } = params
  
  let dateFilter = ''
  const queryParams = []
  
  if (startDate) {
    dateFilter += ' AND f.fee_date >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    dateFilter += ' AND f.fee_date <= ?'
    queryParams.push(endDate)
  }
  
  // 获取订单维度的费用汇总
  const stats = await db.prepare(`
    SELECT 
      f.bill_id,
      f.bill_number,
      f.customer_id,
      f.customer_name,
      COUNT(*) as fee_count,
      COALESCE(SUM(f.amount), 0) as total_amount,
      COALESCE(SUM(CASE WHEN f.category = 'freight' THEN f.amount ELSE 0 END), 0) as freight_amount,
      COALESCE(SUM(CASE WHEN f.category = 'customs' THEN f.amount ELSE 0 END), 0) as customs_amount,
      COALESCE(SUM(CASE WHEN f.category = 'warehouse' THEN f.amount ELSE 0 END), 0) as warehouse_amount,
      COALESCE(SUM(CASE WHEN f.category = 'insurance' THEN f.amount ELSE 0 END), 0) as insurance_amount,
      COALESCE(SUM(CASE WHEN f.category = 'handling' THEN f.amount ELSE 0 END), 0) as handling_amount,
      COALESCE(SUM(CASE WHEN f.category = 'documentation' THEN f.amount ELSE 0 END), 0) as documentation_amount,
      COALESCE(SUM(CASE WHEN f.category = 'other' THEN f.amount ELSE 0 END), 0) as other_amount,
      MIN(f.fee_date) as first_fee_date,
      MAX(f.fee_date) as last_fee_date
    FROM fees f
    WHERE f.bill_id IS NOT NULL ${dateFilter}
    GROUP BY f.bill_id, f.bill_number, f.customer_id, f.customer_name
    ORDER BY total_amount DESC
  `).all(...queryParams)
  
  // 获取总计
  const summaryResult = await db.prepare(`
    SELECT 
      COUNT(DISTINCT f.bill_id) as order_count,
      COUNT(*) as fee_count,
      COALESCE(SUM(f.amount), 0) as total_amount
    FROM fees f
    WHERE f.bill_id IS NOT NULL ${dateFilter}
  `).get(...queryParams)
  
  // 分页
  const total = stats.length
  const startIdx = (page - 1) * pageSize
  const paginatedList = stats.slice(startIdx, startIdx + pageSize)
  
  return {
    list: paginatedList.map(row => ({
      billId: row.bill_id,
      billNumber: row.bill_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      feeCount: row.fee_count,
      totalAmount: row.total_amount,
      freightAmount: row.freight_amount,
      customsAmount: row.customs_amount,
      warehouseAmount: row.warehouse_amount,
      insuranceAmount: row.insurance_amount,
      handlingAmount: row.handling_amount,
      documentationAmount: row.documentation_amount,
      otherAmount: row.other_amount,
      firstFeeDate: row.first_fee_date,
      lastFeeDate: row.last_fee_date
    })),
    total,
    page,
    pageSize,
    summary: {
      orderCount: summaryResult.order_count,
      feeCount: summaryResult.fee_count,
      totalAmount: summaryResult.total_amount
    }
  }
}

/**
 * 获取客户维度的费用统计报表
 */
export async function getCustomerFeeReport(params = {}) {
  const db = getDatabase()
  const { startDate, endDate, page = 1, pageSize = 20 } = params
  
  let dateFilter = ''
  const queryParams = []
  
  if (startDate) {
    dateFilter += ' AND f.fee_date >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    dateFilter += ' AND f.fee_date <= ?'
    queryParams.push(endDate)
  }
  
  // 获取客户维度的费用汇总
  const stats = await db.prepare(`
    SELECT 
      f.customer_id,
      f.customer_name,
      COUNT(DISTINCT f.bill_id) as order_count,
      COUNT(*) as fee_count,
      COALESCE(SUM(f.amount), 0) as total_amount,
      COALESCE(SUM(CASE WHEN f.category = 'freight' THEN f.amount ELSE 0 END), 0) as freight_amount,
      COALESCE(SUM(CASE WHEN f.category = 'customs' THEN f.amount ELSE 0 END), 0) as customs_amount,
      COALESCE(SUM(CASE WHEN f.category = 'warehouse' THEN f.amount ELSE 0 END), 0) as warehouse_amount,
      COALESCE(SUM(CASE WHEN f.category = 'handling' THEN f.amount ELSE 0 END), 0) as handling_amount,
      COALESCE(SUM(CASE WHEN f.category = 'other' THEN f.amount ELSE 0 END), 0) as other_amount
    FROM fees f
    WHERE f.customer_id IS NOT NULL ${dateFilter}
    GROUP BY f.customer_id, f.customer_name
    ORDER BY total_amount DESC
  `).all(...queryParams)
  
  // 分页
  const total = stats.length
  const startIdx = (page - 1) * pageSize
  const paginatedList = stats.slice(startIdx, startIdx + pageSize)
  
  return {
    list: paginatedList.map(row => ({
      customerId: row.customer_id,
      customerName: row.customer_name,
      orderCount: row.order_count,
      feeCount: row.fee_count,
      totalAmount: row.total_amount,
      freightAmount: row.freight_amount,
      customsAmount: row.customs_amount,
      warehouseAmount: row.warehouse_amount,
      handlingAmount: row.handling_amount,
      otherAmount: row.other_amount
    })),
    total,
    page,
    pageSize
  }
}

// ==================== 工具函数 ====================

/**
 * 生成发票号
 */
async function generateInvoiceNumber(type) {
  const db = getDatabase()
  const prefix = type === 'sales' ? 'INV' : 'PINV'
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  
  // 获取今日最大序号
  const result = await db.prepare(`
    SELECT invoice_number FROM invoices 
    WHERE invoice_number LIKE ? 
    ORDER BY invoice_number DESC LIMIT 1
  `).get(`${prefix}${date}%`)
  
  let seq = 1
  if (result) {
    const lastSeq = parseInt(result.invoice_number.slice(-4))
    seq = lastSeq + 1
  }
  
  return `${prefix}${date}${String(seq).padStart(4, '0')}`
}

/**
 * 生成付款单号
 */
async function generatePaymentNumber(type) {
  const db = getDatabase()
  const prefix = type === 'income' ? 'REC' : 'PAY'
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  
  // 获取今日最大序号
  const result = await db.prepare(`
    SELECT payment_number FROM payments 
    WHERE payment_number LIKE ? 
    ORDER BY payment_number DESC LIMIT 1
  `).get(`${prefix}${date}%`)
  
  let seq = 1
  if (result) {
    const lastSeq = parseInt(result.payment_number.slice(-4))
    seq = lastSeq + 1
  }
  
  return `${prefix}${date}${String(seq).padStart(4, '0')}`
}

// ==================== 数据转换函数 ====================

export function convertInvoiceToCamelCase(row) {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    invoiceType: row.invoice_type,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    customerId: row.customer_id,
    customerName: row.customer_name,
    billId: row.bill_id,
    billNumber: row.bill_number,
    subtotal: row.subtotal,
    taxAmount: row.tax_amount,
    totalAmount: row.total_amount,
    paidAmount: row.paid_amount,
    currency: row.currency,
    exchangeRate: row.exchange_rate,
    description: row.description,
    notes: row.notes,
    status: row.status,
    createdBy: row.created_by,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export function convertPaymentToCamelCase(row) {
  return {
    id: row.id,
    paymentNumber: row.payment_number,
    paymentType: row.payment_type,
    paymentDate: row.payment_date,
    paymentMethod: row.payment_method,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    amount: row.amount,
    currency: row.currency,
    exchangeRate: row.exchange_rate,
    bankAccount: row.bank_account,
    referenceNumber: row.reference_number,
    description: row.description,
    notes: row.notes,
    status: row.status,
    createdBy: row.created_by,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export function convertFeeToCamelCase(row) {
  return {
    id: row.id,
    billId: row.bill_id,
    billNumber: row.bill_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    category: row.category,
    feeName: row.fee_name,
    amount: row.amount,
    currency: row.currency,
    exchangeRate: row.exchange_rate,
    feeDate: row.fee_date,
    description: row.description,
    notes: row.notes,
    createdBy: row.created_by,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export default {
  // 常量
  INVOICE_TYPE,
  INVOICE_STATUS,
  PAYMENT_TYPE,
  PAYMENT_METHOD,
  FEE_CATEGORY,
  
  // 发票管理
  getInvoices,
  getInvoiceStats,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  updateInvoicePaidAmount,
  
  // 付款管理
  getPayments,
  getPaymentStats,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  
  // 费用管理
  getFees,
  getFeeStats,
  getFeeById,
  createFee,
  updateFee,
  deleteFee,
  
  // 提单财务
  getBillFinanceSummary,
  
  // 报表
  getOrderFeeReport,
  getCustomerFeeReport,
  
  // 转换函数
  convertInvoiceToCamelCase,
  convertPaymentToCamelCase,
  convertFeeToCamelCase
}

