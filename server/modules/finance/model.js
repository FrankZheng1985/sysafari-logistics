/**
 * 财务管理模块 - 数据模型
 * 包含：发票管理、收付款跟踪、费用管理、财务统计
 */

import { getDatabase, generateId } from '../../config/database.js'
import * as messageModel from '../message/model.js'

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
  
  // 默认只查询未删除的发票
  let query = 'SELECT * FROM invoices WHERE (is_deleted IS NULL OR is_deleted = FALSE)'
  const queryParams = []
  
  if (type) {
    query += ' AND invoice_type = ?'
    queryParams.push(type)
  }
  
  if (status) {
    // 支持特殊筛选条件
    if (status === 'pending') {
      // 待收/待付：issued、unpaid 或 partial，且未逾期
      query += ` AND status IN ('issued', 'unpaid', 'partial') AND (due_date IS NULL OR due_date >= CURRENT_DATE)`
    } else if (status === 'overdue') {
      // 逾期：due_date < 当前日期 且 status 不是 paid/cancelled
      query += ` AND due_date < CURRENT_DATE AND status NOT IN ('paid', 'cancelled')`
    } else if (status === 'unpaid_all') {
      // 所有未付清的发票（包括逾期的）- pending、issued、unpaid、partial 都算未付清
      query += ` AND status IN ('pending', 'issued', 'unpaid', 'partial')`
    } else if (status.includes(',')) {
      // 支持多个状态值（逗号分隔），用于历史记录页面查询 paid,cancelled
      const statuses = status.split(',').map(s => s.trim()).filter(s => s)
      if (statuses.length > 0) {
        const placeholders = statuses.map(() => '?').join(', ')
        query += ` AND status IN (${placeholders})`
        queryParams.push(...statuses)
      }
    } else {
      query += ' AND status = ?'
      queryParams.push(status)
    }
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
    query += ` AND (invoice_number LIKE ? OR customer_name LIKE ? OR description LIKE ? OR bill_number LIKE ? OR container_numbers LIKE ?)`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern)
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
  
  // 销售发票统计（排除已删除的发票）
  // 状态说明: paid=已收, unpaid=未收, partial=部分收款, pending=待处理, cancelled=已取消
  // 待收 = pending + unpaid + partial (不含逾期)
  // 逾期 = due_date < 当前日期 且 status 不是 paid/cancelled
  const salesStats = await db.prepare(`
    SELECT 
      COUNT(*) as total_count,
      COALESCE(SUM(total_amount), 0) as total_amount,
      COALESCE(SUM(paid_amount), 0) as paid_amount,
      COALESCE(SUM(total_amount - paid_amount), 0) as unpaid_amount,
      SUM(CASE WHEN status IN ('pending', 'unpaid', 'partial') AND (due_date IS NULL OR due_date >= CURRENT_DATE) THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
      SUM(CASE WHEN due_date < CURRENT_DATE AND status NOT IN ('paid', 'cancelled') THEN 1 ELSE 0 END) as overdue_count
    FROM invoices 
    WHERE invoice_type = 'sales' AND (is_deleted IS NULL OR is_deleted = FALSE) ${dateFilter}
  `).get(...queryParams)
  
  // 采购发票统计（排除已删除的发票）
  // 状态说明: paid=已付, unpaid=未付, partial=部分付款, pending=待处理, cancelled=已取消
  // 待付 = pending + unpaid + partial (不含逾期)
  // 逾期 = due_date < 当前日期 且 status 不是 paid/cancelled
  const purchaseStats = await db.prepare(`
    SELECT 
      COUNT(*) as total_count,
      COALESCE(SUM(total_amount), 0) as total_amount,
      COALESCE(SUM(paid_amount), 0) as paid_amount,
      COALESCE(SUM(total_amount - paid_amount), 0) as unpaid_amount,
      SUM(CASE WHEN status IN ('pending', 'unpaid', 'partial') AND (due_date IS NULL OR due_date >= CURRENT_DATE) THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
      SUM(CASE WHEN due_date < CURRENT_DATE AND status NOT IN ('paid', 'cancelled') THEN 1 ELSE 0 END) as overdue_count
    FROM invoices 
    WHERE invoice_type = 'purchase' AND (is_deleted IS NULL OR is_deleted = FALSE) ${dateFilter}
  `).get(...queryParams)
  
  // 确保数值类型正确（PostgreSQL返回字符串）
  return {
    sales: {
      totalCount: Number(salesStats.total_count || 0),
      totalAmount: Number(salesStats.total_amount || 0),
      paidAmount: Number(salesStats.paid_amount || 0),
      unpaidAmount: Number(salesStats.unpaid_amount || 0),
      pendingCount: Number(salesStats.pending_count || 0),
      paidCount: Number(salesStats.paid_count || 0),
      overdueCount: Number(salesStats.overdue_count || 0)
    },
    purchase: {
      totalCount: Number(purchaseStats.total_count || 0),
      totalAmount: Number(purchaseStats.total_amount || 0),
      paidAmount: Number(purchaseStats.paid_amount || 0),
      unpaidAmount: Number(purchaseStats.unpaid_amount || 0),
      pendingCount: Number(purchaseStats.pending_count || 0),
      paidCount: Number(purchaseStats.paid_count || 0),
      overdueCount: Number(purchaseStats.overdue_count || 0)
    },
    balance: {
      receivable: Number(salesStats.unpaid_amount || 0),
      payable: Number(purchaseStats.unpaid_amount || 0),
      net: Number(salesStats.unpaid_amount || 0) - Number(purchaseStats.unpaid_amount || 0)
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
  
  // 处理集装箱号数组
  const containerNumbers = Array.isArray(data.containerNumbers) 
    ? JSON.stringify(data.containerNumbers) 
    : JSON.stringify([])
  
  // 处理 items 数组并提取费用IDs
  const items = typeof data.items === 'string' 
    ? data.items 
    : (Array.isArray(data.items) ? JSON.stringify(data.items) : null)
  
  // 解析 items 获取所有关联的费用IDs
  let feeIds = []
  try {
    const parsedItems = typeof data.items === 'string' ? JSON.parse(data.items) : data.items
    if (Array.isArray(parsedItems)) {
      parsedItems.forEach(item => {
        if (item.feeId) {
          // feeId 可能是逗号分隔的多个ID（合并费用时）
          const ids = item.feeId.split(',').map(id => id.trim()).filter(id => id)
          feeIds.push(...ids)
        }
      })
    }
  } catch (e) {
    console.error('[createInvoice] 解析 items 失败:', e)
  }
  
  // 处理额外的已勾选费用ID（来自右侧供应商费用列表）
  // 这些费用可能因为Excel匹配失败而没有被包含在items中，但用户已经勾选了它们
  if (Array.isArray(data.additionalFeeIds) && data.additionalFeeIds.length > 0) {
    console.log('[createInvoice] 收到额外的已勾选费用IDs:', data.additionalFeeIds)
    feeIds.push(...data.additionalFeeIds)
  }
  
  // 将费用IDs存储为JSON，以便删除发票时能找到关联费用
  const feeIdsJson = feeIds.length > 0 ? JSON.stringify([...new Set(feeIds)]) : null
  
  const result = await db.prepare(`
    INSERT INTO invoices (
      id, invoice_number, invoice_type, invoice_date, due_date,
      customer_id, customer_name, bill_id, bill_number, container_numbers,
      subtotal, tax_amount, total_amount, paid_amount,
      currency, exchange_rate, description, items, notes, fee_ids,
      status, language, template_id, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
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
    containerNumbers,
    data.subtotal || 0,
    data.taxAmount || 0,
    data.totalAmount || data.subtotal || 0,
    0, // paid_amount starts at 0
    data.currency || 'EUR',
    data.exchangeRate || 1,
    data.description || '',
    items,
    data.notes || '',
    feeIdsJson,  // 存储关联的费用IDs
    data.status || 'issued',
    data.language || 'en',  // 发票语言，默认英文
    data.templateId || null,  // 发票模版ID
    data.createdBy || null
  )
  
  // 更新关联费用的开票状态（支持部分开票）
  if (feeIds.length > 0) {
    const uniqueFeeIds = [...new Set(feeIds)]
    console.log(`[createInvoice] 准备更新 ${uniqueFeeIds.length} 条费用记录的开票状态, feeIds:`, uniqueFeeIds)
    
    // 🔥 构建费用ID到开票金额的映射
    const feeAmountMap = new Map()
    try {
      const parsedItems = typeof data.items === 'string' ? JSON.parse(data.items) : data.items
      if (Array.isArray(parsedItems)) {
        parsedItems.forEach(item => {
          if (item.feeId) {
            // feeId 可能是逗号分隔的多个ID（合并费用时）
            const ids = item.feeId.split(',').map(id => id.trim()).filter(id => id)
            // 如果是合并费用，金额需要平分或按比例分配
            // 这里简化处理：使用 finalAmount 或 unitPrice * quantity
            const itemAmount = parseFloat(item.finalAmount) || (parseFloat(item.unitPrice || 0) * parseFloat(item.quantity || 1))
            if (ids.length === 1) {
              // 单个费用
              feeAmountMap.set(ids[0], (feeAmountMap.get(ids[0]) || 0) + itemAmount)
            } else {
              // 合并费用：需要根据各费用原始金额按比例分配
              // 这里暂时平均分配
              const perFeeAmount = itemAmount / ids.length
              ids.forEach(id => {
                feeAmountMap.set(id, (feeAmountMap.get(id) || 0) + perFeeAmount)
              })
            }
          }
        })
      }
    } catch (e) {
      console.error('[createInvoice] 解析 items 构建金额映射失败:', e)
    }
    console.log(`[createInvoice] 费用金额映射:`, Object.fromEntries(feeAmountMap))
    
    let updatedCount = 0
    for (const feeId of uniqueFeeIds) {
      try {
        // 获取当前费用信息
        const fee = await db.prepare(`SELECT amount, invoiced_amount FROM fees WHERE id = ?`).get(feeId)
        if (!fee) {
          console.warn(`[createInvoice] 费用 ${feeId} 未找到`)
          continue
        }
        
        const feeAmount = parseFloat(fee.amount) || 0
        const currentInvoicedAmount = parseFloat(fee.invoiced_amount) || 0
        const invoicingAmount = feeAmountMap.get(feeId) || feeAmount // 本次开票金额，如果没有映射则用全额
        const newInvoicedAmount = currentInvoicedAmount + invoicingAmount
        
        // 🔥 只有当累计开票金额 >= 费用金额时，才标记为已完全开票
        const newInvoiceStatus = newInvoicedAmount >= feeAmount ? 'invoiced' : 'partial_invoiced'
        
        const updateResult = await db.prepare(`
          UPDATE fees SET 
            invoiced_amount = ?,
            invoice_status = ?,
            invoice_number = CASE 
              WHEN invoice_number IS NULL OR invoice_number = '' THEN ?
              ELSE invoice_number || ',' || ?
            END,
            invoice_date = ?,
            updated_at = NOW()
          WHERE id = ?
        `).run(
          newInvoicedAmount,
          newInvoiceStatus,
          invoiceNumber, invoiceNumber,
          data.invoiceDate || new Date().toISOString().split('T')[0],
          feeId
        )
        
        if (updateResult.changes > 0) {
          updatedCount++
          console.log(`[createInvoice] 成功更新费用 ${feeId}: 本次开票 ${invoicingAmount}, 累计 ${newInvoicedAmount}/${feeAmount}, 状态 ${newInvoiceStatus}`)
        } else {
          console.warn(`[createInvoice] 费用 ${feeId} 未更新`)
        }
      } catch (e) {
        console.error(`[createInvoice] 更新费用 ${feeId} 开票状态失败:`, e)
      }
    }
    console.log(`[createInvoice] 实际更新了 ${updatedCount}/${uniqueFeeIds.length} 条费用记录的开票状态`)
  } else {
    console.warn(`[createInvoice] 没有找到关联的费用ID，无法更新开票状态`)
  }
  
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
    status: 'status',
    language: 'language',  // 发票语言
    templateId: 'template_id'  // 发票模版ID
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  // 特殊处理集装箱号数组
  if (data.containerNumbers !== undefined) {
    fields.push('container_numbers = ?')
    values.push(Array.isArray(data.containerNumbers) 
      ? JSON.stringify(data.containerNumbers) 
      : JSON.stringify([]))
  }
  
  // 特殊处理 items 数组
  if (data.items !== undefined) {
    fields.push('items = ?')
    const itemsValue = typeof data.items === 'string' 
      ? data.items 
      : (Array.isArray(data.items) ? JSON.stringify(data.items) : null)
    values.push(itemsValue)
  }
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = NOW()")
  values.push(id)
  
  const result = await db.prepare(`UPDATE invoices SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除发票（软删除）
 * 只标记为已删除，不真正删除记录，确保发票号不会被重复使用
 * 同时重置关联费用的开票状态，使其回到"待开票"
 */
export async function deleteInvoice(id) {
  const db = getDatabase()
  
  // 1. 获取发票记录，获取关联的费用ID和发票号
  const invoice = await db.prepare('SELECT fee_ids, invoice_number, items FROM invoices WHERE id = ?').get(id)
  
  let feeIds = []
  
  // 2. 尝试从 fee_ids 字段获取费用ID
  if (invoice && invoice.fee_ids) {
    try {
      const parsedFeeIds = JSON.parse(invoice.fee_ids)
      if (Array.isArray(parsedFeeIds)) {
        feeIds = parsedFeeIds
      }
    } catch (e) {
      console.error('[deleteInvoice] 解析 fee_ids 失败:', e)
    }
  }
  
  // 3. 如果 fee_ids 为空，尝试从 items 字段解析费用ID（兼容旧数据）
  if (feeIds.length === 0 && invoice && invoice.items) {
    try {
      const parsedItems = JSON.parse(invoice.items)
      if (Array.isArray(parsedItems)) {
        parsedItems.forEach(item => {
          if (item.feeId) {
            const ids = item.feeId.split(',').map(id => id.trim()).filter(id => id)
            feeIds.push(...ids)
          }
        })
      }
    } catch (e) {
      console.error('[deleteInvoice] 解析 items 失败:', e)
    }
  }
  
  // 4. 如果还是没有找到费用ID，通过发票号查询费用表（最终回退方案）
  if (feeIds.length === 0 && invoice && invoice.invoice_number) {
    try {
      const fees = await db.prepare(`
        SELECT id FROM fees WHERE invoice_number = ?
      `).all(invoice.invoice_number)
      if (fees && fees.length > 0) {
        feeIds = fees.map(f => f.id)
        console.log(`[deleteInvoice] 通过发票号 ${invoice.invoice_number} 找到 ${feeIds.length} 条关联费用`)
      }
    } catch (e) {
      console.error('[deleteInvoice] 通过发票号查询费用失败:', e)
    }
  }
  
  // 5. 重置关联费用的开票状态和付款状态
  if (feeIds.length > 0) {
    const uniqueFeeIds = [...new Set(feeIds)]
    for (const feeId of uniqueFeeIds) {
      try {
        await db.prepare(`
          UPDATE fees SET 
            invoice_status = 'not_invoiced',
            invoice_number = NULL,
            invoice_date = NULL,
            payment_status = 'unpaid',
            updated_at = NOW()
          WHERE id = ?
        `).run(feeId)
      } catch (e) {
        console.error(`[deleteInvoice] 重置费用 ${feeId} 状态失败:`, e)
      }
    }
    console.log(`[deleteInvoice] 已重置 ${uniqueFeeIds.length} 条费用记录的开票状态和付款状态，恢复为可选择`)
  }
  
  // 6. 软删除：标记为已删除，记录删除时间
  const result = await db.prepare(`
    UPDATE invoices 
    SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW() 
    WHERE id = ?
  `).run(id)
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
  
  // 获取发票信息（包含 bill_id、invoice_number、customer_id 和 fee_ids）
  const invoice = await db.prepare(`
    SELECT total_amount, bill_id, invoice_number, invoice_type, customer_id, fee_ids 
    FROM invoices WHERE id = ?
  `).get(id)
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
    SET paid_amount = ?, status = ?, updated_at = NOW()
    WHERE id = ?
  `).run(paidAmount, status, id)
  
  // 同步更新关联费用的 payment_status
  let feeIds = []
  if (invoice.fee_ids) {
    try {
      feeIds = JSON.parse(invoice.fee_ids)
    } catch (e) {
      feeIds = []
    }
  }
  
  if (feeIds.length > 0) {
    const feePaymentStatus = status === 'paid' ? 'paid' : (status === 'partial' ? 'partial' : 'unpaid')
    for (const feeId of feeIds) {
      try {
        await db.prepare(`
          UPDATE fees SET 
            payment_status = ?,
            updated_at = NOW()
          WHERE id = ?
        `).run(feePaymentStatus, feeId)
      } catch (e) {
        console.error(`[updateInvoicePaidAmount] 更新费用 ${feeId} 的 payment_status 失败:`, e)
      }
    }
    console.log(`[核销同步] 发票 ${invoice.invoice_number} 状态变为 ${status}，已同步更新 ${feeIds.length} 条费用的 payment_status 为 ${feePaymentStatus}`)
  }
  
  // 如果发票变为已付清状态，且是销售发票
  if (status === 'paid' && invoice.invoice_type === 'sales') {
    // 1. 自动更新关联订单的主发票号
    if (invoice.bill_id && invoice.invoice_number) {
      // 处理多订单关联的情况（bill_id 可能是逗号分隔的多个ID）
      const billIds = invoice.bill_id.split(',').map(id => id.trim()).filter(id => id)
      
      for (const billId of billIds) {
        // 只有当订单还没有主发票号时才更新
        const bill = await db.prepare(`
          SELECT primary_invoice_number FROM bills_of_lading WHERE id = ?
        `).get(billId)
        
        if (bill && !bill.primary_invoice_number) {
          await db.prepare(`
            UPDATE bills_of_lading 
            SET primary_invoice_number = ?, payment_confirmed = 1, updated_at = NOW()
            WHERE id = ?
          `).run(invoice.invoice_number, billId)
          console.log(`[Auto] 订单 ${billId} 主发票号已自动设置为 ${invoice.invoice_number}`)
        }
      }
    }
    
    // 2. 自动消除该发票相关的预警（账期即将到期、应收逾期）
    await messageModel.autoResolveAlerts(
      'invoice', 
      id, 
      ['payment_term_due', 'payment_due'], 
      `发票已付清，系统自动处理`
    )
    console.log(`[预警自动消除] 发票 ${invoice.invoice_number} 已付清，相关预警已自动处理`)
    
    // 3. 检查并消除客户相关预警（多笔逾期、信用超限）
    if (invoice.customer_id) {
      await messageModel.checkAndResolveCustomerAlerts(invoice.customer_id)
    }
  }
  
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
  
  // JOIN invoices 表获取 container_numbers（兼容多发票）
  let query = `
    SELECT p.*, i.container_numbers AS invoice_container_numbers
    FROM payments p
    LEFT JOIN invoices i ON p.invoice_id = i.id
    WHERE 1=1
  `
  const queryParams = []
  
  if (type) {
    query += ' AND p.payment_type = ?'
    queryParams.push(type)
  }
  
  if (invoiceId) {
    query += ' AND p.invoice_id = ?'
    queryParams.push(invoiceId)
  }
  
  if (customerId) {
    query += ' AND p.customer_id = ?'
    queryParams.push(customerId)
  }
  
  if (method) {
    query += ' AND p.payment_method = ?'
    queryParams.push(method)
  }
  
  if (status) {
    query += ' AND p.status = ?'
    queryParams.push(status)
  }
  
  if (startDate) {
    query += ' AND p.payment_date >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND p.payment_date <= ?'
    queryParams.push(endDate)
  }
  
  if (search) {
    query += ` AND (p.payment_number LIKE ? OR p.customer_name LIKE ? OR p.description LIKE ? OR i.container_numbers LIKE ?)`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace(/SELECT p\.\*, i\.container_numbers AS invoice_container_numbers/i, 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY p.payment_date DESC, p.created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  // 转换为 camelCase，并添加发票数量信息和所有关联发票详情
  const convertedList = await Promise.all(list.map(async (payment) => {
    const converted = convertPaymentToCamelCase(payment)
    
    // 如果有 invoice_ids，获取所有关联发票的信息
    if (payment.invoice_ids) {
      try {
        const invoiceIds = JSON.parse(payment.invoice_ids)
        if (Array.isArray(invoiceIds) && invoiceIds.length > 0) {
          converted.invoiceCount = invoiceIds.length
          
          // 获取所有关联发票的详细信息
          const invoicesData = []
          const allContainerNumbers = []  // 不去重，保留所有集装箱号
          
          for (const invId of invoiceIds) {
            const invoice = await getInvoiceById(invId)
            if (invoice) {
              invoicesData.push({
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                customerName: invoice.customerName,
                totalAmount: invoice.totalAmount,
                paidAmount: invoice.paidAmount,
                currency: invoice.currency,
                status: invoice.status,
                containerNumbers: invoice.containerNumbers || []
              })
              // 收集所有集装箱号（不去重）
              if (invoice.containerNumbers && Array.isArray(invoice.containerNumbers)) {
                allContainerNumbers.push(...invoice.containerNumbers)
              }
            }
          }
          
          converted.invoices = invoicesData
          converted.containerNumbers = allContainerNumbers
        } else {
          converted.invoiceCount = payment.invoice_id ? 1 : 0
        }
      } catch {
        converted.invoiceCount = payment.invoice_id ? 1 : 0
      }
    } else {
      converted.invoiceCount = payment.invoice_id ? 1 : 0
    }
    
    return converted
  }))
  
  return {
    list: convertedList,
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
  
  // 收款统计 (支持 income 和 receipt 两种类型)
  const incomeStats = await db.prepare(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as total
    FROM payments 
    WHERE payment_type IN ('income', 'receipt') AND status IN ('completed', 'confirmed') ${dateFilter}
  `).get(...queryParams)
  
  // 付款统计 (支持 expense 和 payment 两种类型)
  const expenseStats = await db.prepare(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as total
    FROM payments 
    WHERE payment_type IN ('expense', 'payment') AND status IN ('completed', 'confirmed') ${dateFilter}
  `).get(...queryParams)
  
  // 确保数值类型正确（PostgreSQL返回字符串）
  return {
    income: {
      count: Number(incomeStats.count || 0),
      total: Number(incomeStats.total || 0)
    },
    expense: {
      count: Number(expenseStats.count || 0),
      total: Number(expenseStats.total || 0)
    },
    netCashFlow: Number(incomeStats.total || 0) - Number(expenseStats.total || 0)
  }
}

/**
 * 根据ID获取付款记录（包含关联信息）
 * 支持多发票关联
 */
export async function getPaymentById(id) {
  const db = getDatabase()
  
  // 获取付款基本记录和客户信息
  const payment = await db.prepare(`
    SELECT 
      p.*,
      c.company_name AS customer_company_name,
      c.contact_person AS customer_contact_name,
      c.contact_phone AS customer_phone,
      c.contact_email AS customer_email,
      c.address AS customer_address
    FROM payments p
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE p.id = ?
  `).get(id)
  
  if (!payment) return null
  
  // 解析关联的多个发票ID
  let invoiceIds = []
  if (payment.invoice_ids) {
    try {
      invoiceIds = JSON.parse(payment.invoice_ids)
    } catch (e) {
      invoiceIds = []
    }
  }
  // 兼容旧数据：如果没有 invoice_ids 但有 invoice_id
  if (invoiceIds.length === 0 && payment.invoice_id) {
    invoiceIds = [payment.invoice_id]
  }
  
  // 获取所有关联发票的详细信息
  let invoices = []
  let allInvoiceItems = []
  let allContainerNumbers = []
  let billInfoList = []
  
  for (const invoiceId of invoiceIds) {
    const invoice = await db.prepare(`
      SELECT 
        i.*,
        b.id AS bill_id,
        b.bill_number,
        b.container_number,
        b.customer_name AS bill_customer_name,
        b.consignee,
        b.port_of_loading,
        b.port_of_discharge,
        b.eta,
        b.ata,
        b.delivery_status,
        b.status AS bill_status
      FROM invoices i
      LEFT JOIN bills_of_lading b ON i.bill_id = b.id
      WHERE i.id = ?
    `).get(invoiceId)
    
    if (invoice) {
      // 解析发票明细
      let items = []
      if (invoice.items) {
        try {
          items = JSON.parse(invoice.items)
        } catch (e) {
          items = []
        }
      }
      allInvoiceItems = allInvoiceItems.concat(items)
      
      // 解析集装箱号
      let containerNums = []
      if (invoice.container_numbers) {
        try {
          containerNums = JSON.parse(invoice.container_numbers)
        } catch (e) {
          containerNums = []
        }
      }
      allContainerNumbers = allContainerNumbers.concat(containerNums)
      
      // 构建发票对象
      invoices.push({
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        invoiceType: invoice.invoice_type,
        totalAmount: Number(invoice.total_amount || 0),
        paidAmount: Number(invoice.paid_amount || 0),
        status: invoice.status,
        dueDate: invoice.due_date,
        items: items,
        containerNumbers: containerNums,
        billId: invoice.bill_id,
        billNumber: invoice.bill_number
      })
      
      // 收集提单信息
      if (invoice.bill_id) {
        billInfoList.push({
          id: invoice.bill_id,
          billNumber: invoice.bill_number,
          containerNumber: invoice.container_number,
          customerName: invoice.bill_customer_name,
          consignee: invoice.consignee,
          portOfLoading: invoice.port_of_loading,
          portOfDischarge: invoice.port_of_discharge,
          eta: invoice.eta,
          ata: invoice.ata,
          deliveryStatus: invoice.delivery_status,
          status: invoice.bill_status
        })
      }
    }
  }
  
  // 去重集装箱号
  allContainerNumbers = [...new Set(allContainerNumbers)]
  
  // 去重提单（按ID）
  const uniqueBillInfoMap = new Map()
  billInfoList.forEach(bill => {
    if (bill.id && !uniqueBillInfoMap.has(bill.id)) {
      uniqueBillInfoMap.set(bill.id, bill)
    }
  })
  const uniqueBillInfoList = Array.from(uniqueBillInfoMap.values())
  
  // 获取银行账户信息
  let bankAccountInfo = null
  if (payment.bank_account) {
    bankAccountInfo = await db.prepare(`
      SELECT id, account_name, bank_name, account_number, iban, swift_code, currency
      FROM bank_accounts
      WHERE account_name = ?
    `).get(payment.bank_account)
    
    if (bankAccountInfo) {
      bankAccountInfo = {
        id: bankAccountInfo.id,
        accountName: bankAccountInfo.account_name,
        bankName: bankAccountInfo.bank_name,
        accountNumber: bankAccountInfo.account_number,
        iban: bankAccountInfo.iban,
        swiftCode: bankAccountInfo.swift_code,
        currency: bankAccountInfo.currency
      }
    }
  }
  
  // 兼容旧格式：如果只有一张发票，保留原有字段
  const primaryInvoice = invoices.length > 0 ? invoices[0] : null
  
  return {
    ...convertPaymentToCamelCase(payment),
    // 多发票列表（新格式）
    invoices,
    invoiceCount: invoices.length,
    // 汇总信息
    containerNumbers: allContainerNumbers,
    invoiceItems: allInvoiceItems,
    billInfoList: uniqueBillInfoList,
    // 兼容旧格式（主发票信息）
    invoiceType: primaryInvoice?.invoiceType,
    invoiceTotalAmount: primaryInvoice?.totalAmount,
    invoicePaidAmount: primaryInvoice?.paidAmount,
    invoiceStatus: primaryInvoice?.status,
    invoiceDueDate: primaryInvoice?.dueDate,
    billInfo: uniqueBillInfoList.length > 0 ? uniqueBillInfoList[0] : null,
    // 客户详细信息
    customerCompanyName: payment.customer_company_name,
    customerContactName: payment.customer_contact_name,
    customerPhone: payment.customer_phone,
    customerEmail: payment.customer_email,
    customerAddress: payment.customer_address,
    // 银行账户信息
    bankAccountInfo
  }
}

/**
 * 创建付款记录
 * @param {Object} data - 付款数据
 * @param {string[]} data.invoiceIds - 多发票ID数组（批量核销）
 * @param {string} data.invoiceId - 单发票ID（单独核销）
 * 
 * 批量核销逻辑：创建1条付款记录，关联多张发票
 * - 1个收款单号
 * - 金额 = 所有发票未付金额之和
 * - invoice_ids 存储所有发票ID的JSON数组
 * - 每张发票的 paid_amount 更新为各自的 total_amount（全额核销）
 */
export async function createPayment(data) {
  const db = getDatabase()
  const id = generateId()
  
  // 生成付款单号
  const paymentNumber = await generatePaymentNumber(data.paymentType)
  
  // 处理多发票关联
  let invoiceIds = []
  if (data.invoiceIds && Array.isArray(data.invoiceIds) && data.invoiceIds.length > 0) {
    invoiceIds = data.invoiceIds
  } else if (data.invoiceId) {
    invoiceIds = [data.invoiceId]
  }
  
  // 第一张发票作为主发票（兼容旧逻辑）
  const primaryInvoiceId = invoiceIds.length > 0 ? invoiceIds[0] : null
  const invoiceIdsJson = invoiceIds.length > 1 ? JSON.stringify(invoiceIds) : null
  
  // 收集所有发票信息，计算总金额
  const invoiceNumbers = []
  let totalAmount = 0
  const invoiceAmounts = [] // 记录每张发票的未付金额
  
  for (const invId of invoiceIds) {
    const invoice = await getInvoiceById(invId)
    if (invoice) {
      invoiceNumbers.push(invoice.invoiceNumber)
      const unpaidAmount = invoice.totalAmount - invoice.paidAmount
      totalAmount += unpaidAmount
      invoiceAmounts.push({ invoiceId: invId, amount: unpaidAmount })
    }
  }
  
  // 发票号显示：多张时逗号分隔
  const invoiceNumber = invoiceNumbers.join(', ')
  
  // 使用计算的总金额，如果前端传了 amount 则用前端的
  const finalAmount = data.amount || totalAmount
  
  const result = await db.prepare(`
    INSERT INTO payments (
      id, payment_number, payment_type, payment_date, payment_method,
      invoice_id, invoice_ids, invoice_number, customer_id, customer_name,
      amount, currency, exchange_rate, bank_account, reference_number,
      description, notes, status, created_by,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    id,
    paymentNumber,
    data.paymentType || 'income',
    data.paymentDate || new Date().toISOString().split('T')[0],
    data.paymentMethod || 'bank_transfer',
    primaryInvoiceId,
    invoiceIdsJson,
    invoiceNumber,
    data.customerId || null,
    data.customerName || '',
    finalAmount,
    data.currency || 'EUR',
    data.exchangeRate || 1,
    data.bankAccount || '',
    data.referenceNumber || '',
    data.description || '',
    data.notes || '',
    data.status || 'completed',
    data.createdBy || null
  )
  
  // 更新所有关联发票的付款金额
  // 每张发票按各自的未付金额更新，实现全额核销
  if (data.status === 'completed') {
    for (const { invoiceId: invId, amount: invAmount } of invoiceAmounts) {
      await updateInvoicePaidAmountDirect(invId, invAmount)
    }
  }
  
  return { id, paymentNumber, invoiceCount: invoiceIds.length }
}

/**
 * 直接更新发票的已付金额（增量更新）
 * @param {string} invoiceId - 发票ID
 * @param {number} amount - 本次付款金额
 */
async function updateInvoicePaidAmountDirect(invoiceId, amount) {
  const db = getDatabase()
  
  // 获取发票当前信息
  const invoice = await getInvoiceById(invoiceId)
  if (!invoice) return
  
  // 计算新的已付金额
  const newPaidAmount = Number(invoice.paidAmount) + Number(amount)
  
  // 确定新状态
  let newStatus = 'pending'
  if (newPaidAmount >= invoice.totalAmount) {
    newStatus = 'paid'
  } else if (newPaidAmount > 0) {
    newStatus = 'partial'
  }
  
  await db.prepare(`
    UPDATE invoices SET 
      paid_amount = ?,
      status = ?,
      updated_at = NOW()
    WHERE id = ?
  `).run(newPaidAmount, newStatus, invoiceId)
  
  // 同步更新关联费用的 payment_status
  // 费用的付款状态应该与发票状态同步
  if (invoice.feeIds && invoice.feeIds.length > 0) {
    const feePaymentStatus = newStatus === 'paid' ? 'paid' : (newStatus === 'partial' ? 'partial' : 'unpaid')
    for (const feeId of invoice.feeIds) {
      try {
        await db.prepare(`
          UPDATE fees SET 
            payment_status = ?,
            updated_at = NOW()
          WHERE id = ?
        `).run(feePaymentStatus, feeId)
      } catch (e) {
        console.error(`[updateInvoicePaidAmountDirect] 更新费用 ${feeId} 的 payment_status 失败:`, e)
      }
    }
    console.log(`[核销同步] 发票 ${invoice.invoiceNumber} 状态变为 ${newStatus}，已同步更新 ${invoice.feeIds.length} 条费用的 payment_status 为 ${feePaymentStatus}`)
  }
  
  // 如果发票变为已付清状态，且是销售发票，自动消除相关预警
  if (newStatus === 'paid' && invoice.invoiceType === 'sales') {
    // 1. 自动消除该发票相关的预警（账期即将到期、应收逾期）
    await messageModel.autoResolveAlerts(
      'invoice', 
      invoiceId, 
      ['payment_term_due', 'payment_due'], 
      `发票已付清，系统自动处理`
    )
    console.log(`[预警自动消除] 发票 ${invoice.invoiceNumber} 已付清，相关预警已自动处理`)
    
    // 2. 检查并消除客户相关预警（多笔逾期、信用超限）
    if (invoice.customerId) {
      await messageModel.checkAndResolveCustomerAlerts(invoice.customerId)
    }
  }
}

/**
 * 更新付款记录
 */
export async function updatePayment(id, data) {
  const db = getDatabase()
  
  // 获取原记录
  const original = await getPaymentById(id)
  
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
    status: 'status',
    receiptUrl: 'receipt_url'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = NOW()")
  values.push(id)
  
  const result = await db.prepare(`UPDATE payments SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  
  // 如果关联发票，更新发票付款金额
  if (original && original.invoiceId) {
    await updateInvoicePaidAmount(original.invoiceId)
  }
  
  return result.changes > 0
}

/**
 * 删除付款记录
 */
export async function deletePayment(id) {
  const db = getDatabase()
  
  // 获取原记录
  const original = await getPaymentById(id)
  
  const result = await db.prepare('DELETE FROM payments WHERE id = ?').run(id)
  
  // 如果关联发票，更新发票付款金额
  if (original && original.invoiceId) {
    await updateInvoicePaidAmount(original.invoiceId)
  }
  
  return result.changes > 0
}

// ==================== 费用管理 ====================

/**
 * 获取费用列表（按订单分组分页）
 * 当按 billId 精确查询时，直接返回该订单的费用（不使用分组逻辑）
 * @param {boolean} excludeInvoiced - 是否排除已开票的费用（用于创建发票时）
 */
export async function getFees(params = {}) {
  const db = getDatabase()
  const { 
    category, feeName, billId, customerId, supplierId, supplierName, feeType,
    startDate, endDate, search, excludeInvoiced,
    page = 1, pageSize = 20 
  } = params
  
  // 当按 billId 精确查询时，使用简单查询（避免分组逻辑导致的重复问题）
  if (billId && !search && !customerId && !supplierId) {
    return getFeesSimple({
      billId,
      category,
      feeName,
      feeType,
      startDate,
      endDate,
      page,
      pageSize
    })
  }
  
  // 构建基础 WHERE 条件
  let whereClause = 'WHERE 1=1'
  const queryParams = []
  
  // 排除已开票的费用（用于创建发票时，避免重复开票）
  if (excludeInvoiced === 'true' || excludeInvoiced === true) {
    whereClause += " AND (f.invoice_status IS NULL OR f.invoice_status != 'invoiced')"
    console.log(`[getFees] 启用已开票费用过滤, supplierName=${supplierName}`)
  }
  
  if (feeType) {
    whereClause += ' AND f.fee_type = ?'
    queryParams.push(feeType)
  }
  
  // 支持按费用名称筛选（从统计卡片点击）
  if (feeName) {
    whereClause += ' AND f.fee_name = ?'
    queryParams.push(feeName)
  }
  
  if (category) {
    // 支持按父级分类筛选：先查找是否有匹配的子分类
    // 如果 category 是父级分类名称，则需要匹配所有子分类
    whereClause += ` AND (
      f.category = ? 
      OR f.fee_name = ?
      OR f.category IN (
        SELECT code FROM service_fee_categories 
        WHERE parent_id IN (
          SELECT id FROM service_fee_categories WHERE name = ? OR code = ?
        )
      )
      OR f.fee_name IN (
        SELECT name FROM service_fee_categories 
        WHERE parent_id IN (
          SELECT id FROM service_fee_categories WHERE name = ? OR code = ?
        )
      )
    )`
    queryParams.push(category, category, category, category, category, category)
  }
  
  if (billId) {
    whereClause += ' AND f.bill_id = ?'
    queryParams.push(billId)
  }
  
  if (customerId) {
    whereClause += ' AND f.customer_id = ?'
    queryParams.push(customerId)
  }
  
  if (supplierId) {
    whereClause += ' AND f.supplier_id = ?'
    queryParams.push(supplierId)
  }
  
  // 支持按供应商名称过滤（用于兼容不同ID格式）
  if (supplierName) {
    whereClause += ' AND f.supplier_name = ?'
    queryParams.push(supplierName)
  }
  
  if (startDate) {
    whereClause += ' AND f.fee_date >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    whereClause += ' AND f.fee_date <= ?'
    queryParams.push(endDate)
  }
  
  if (search) {
    // 搜索支持：费用名称、描述、订单号、提单号、集装箱号
    whereClause += ` AND (
      f.fee_name LIKE ? 
      OR f.description LIKE ?
      OR b.order_number LIKE ?
      OR COALESCE(f.bill_number, '') LIKE ?
      OR b.bill_number LIKE ?
      OR b.container_number LIKE ?
    )`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern)
  }
  
  // 步骤1: 获取费用总条数（用于显示）和订单分组数量（用于分页）
  const countQuery = `
    SELECT COUNT(*) as total_fees
    FROM fees f 
    LEFT JOIN bills_of_lading b ON f.bill_id = b.id 
    ${whereClause}
  `
  const totalFeesResult = await db.prepare(countQuery).get(...queryParams)
  const totalFees = totalFeesResult?.total_fees || 0
  
  // 获取不重复的订单分组数量（用于分页）
  const countGroupQuery = `
    SELECT COUNT(DISTINCT COALESCE(b.order_number, f.bill_number, f.id)) as total
    FROM fees f 
    LEFT JOIN bills_of_lading b ON f.bill_id = b.id 
    ${whereClause}
  `
  const totalGroupsResult = await db.prepare(countGroupQuery).get(...queryParams)
  const totalGroups = totalGroupsResult?.total || 0
  
  // 步骤2: 获取当前页的订单分组键列表
  const groupKeysQuery = `
    SELECT DISTINCT COALESCE(b.order_number, f.bill_number, f.id) as group_key,
           MAX(f.fee_date) as latest_fee_date,
           MAX(f.created_at) as latest_created_at
    FROM fees f 
    LEFT JOIN bills_of_lading b ON f.bill_id = b.id 
    ${whereClause}
    GROUP BY COALESCE(b.order_number, f.bill_number, f.id)
    ORDER BY latest_fee_date DESC, latest_created_at DESC
    LIMIT ? OFFSET ?
  `
  const groupKeysParams = [...queryParams, pageSize, (page - 1) * pageSize]
  const groupKeysResult = await db.prepare(groupKeysQuery).all(...groupKeysParams)
  const groupKeys = groupKeysResult.map(r => r.group_key)
  
  if (groupKeys.length === 0) {
    return {
      list: [],
      total: totalGroups,
      page,
      pageSize
    }
  }
  
  // 步骤3: 获取这些分组键对应的所有费用记录
  // 重要：保留原始 WHERE 条件以确保不返回超出范围的数据
  const placeholders = groupKeys.map(() => '?').join(',')
  const feesQuery = `
    SELECT f.*, 
           b.order_number AS bill_order_number,
           b.container_number AS bill_container_number,
           COALESCE(NULLIF(f.bill_number, ''), b.bill_number) as resolved_bill_number,
           COALESCE(NULLIF(f.customer_id, ''), b.customer_id) as resolved_customer_id,
           COALESCE(NULLIF(f.customer_name, ''), b.customer_name) as resolved_customer_name,
           COALESCE(b.order_number, f.bill_number, f.id) as group_key
    FROM fees f 
    LEFT JOIN bills_of_lading b ON f.bill_id = b.id 
    ${whereClause} AND COALESCE(b.order_number, f.bill_number, f.id) IN (${placeholders})
    ORDER BY f.fee_date DESC, f.created_at DESC
  `
  const list = await db.prepare(feesQuery).all(...queryParams, ...groupKeys)
  
  // 调试日志：检查返回费用的 invoice_status
  if (excludeInvoiced === 'true' || excludeInvoiced === true) {
    const feesSummary = list.slice(0, 10).map(f => ({
      id: f.id,
      feeName: f.fee_name,
      containerNumber: f.container_number || f.bill_container_number,
      invoiceStatus: f.invoice_status,
      amount: f.amount
    }))
    console.log(`[getFees] 返回 ${list.length} 条费用, 前10条:`, JSON.stringify(feesSummary, null, 2))
  }
  
  return {
    list: list.map(convertFeeToCamelCase),
    total: totalFees,  // 返回费用条数（与统计卡片一致）
    totalGroups,  // 返回订单分组数（用于分页计算）
    page,
    pageSize
  }
}

/**
 * 简单费用查询（按 billId 精确查询时使用，避免分组导致的重复问题）
 * 默认过滤掉待审批的费用，如需显示请设置 includePending = true
 */
async function getFeesSimple(params = {}) {
  const db = getDatabase()
  const { billId, category, feeName, feeType, startDate, endDate, page = 1, pageSize = 20, includePending = false } = params
  
  let whereClause = 'WHERE f.bill_id = ?'
  const queryParams = [billId]
  
  // 默认过滤掉待审批的费用（追加费用需要审批通过后才计入）
  if (!includePending) {
    whereClause += " AND (f.approval_status IS NULL OR f.approval_status != 'pending')"
  }
  
  if (feeType) {
    whereClause += ' AND f.fee_type = ?'
    queryParams.push(feeType)
  }
  
  // 支持按费用名称筛选（从统计卡片点击）
  if (feeName) {
    whereClause += ' AND f.fee_name = ?'
    queryParams.push(feeName)
  }
  
  if (category) {
    // 支持按父级分类筛选
    whereClause += ` AND (
      f.category = ? 
      OR f.fee_name = ?
      OR f.category IN (
        SELECT code FROM service_fee_categories 
        WHERE parent_id IN (
          SELECT id FROM service_fee_categories WHERE name = ? OR code = ?
        )
      )
      OR f.fee_name IN (
        SELECT name FROM service_fee_categories 
        WHERE parent_id IN (
          SELECT id FROM service_fee_categories WHERE name = ? OR code = ?
        )
      )
    )`
    queryParams.push(category, category, category, category, category, category)
  }
  
  if (startDate) {
    whereClause += ' AND f.fee_date >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    whereClause += ' AND f.fee_date <= ?'
    queryParams.push(endDate)
  }
  
  // 获取总数
  const countQuery = `SELECT COUNT(*) as total FROM fees f ${whereClause}`
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  const total = totalResult?.total || 0
  
  // 获取列表（按 fee_id 去重，确保不返回重复记录）
  const listQuery = `
    SELECT DISTINCT f.*, 
           b.order_number AS bill_order_number,
           b.container_number AS bill_container_number,
           COALESCE(NULLIF(f.bill_number, ''), b.bill_number) as resolved_bill_number,
           COALESCE(NULLIF(f.customer_id, ''), b.customer_id) as resolved_customer_id,
           COALESCE(NULLIF(f.customer_name, ''), b.customer_name) as resolved_customer_name
    FROM fees f 
    LEFT JOIN bills_of_lading b ON f.bill_id = b.id 
    ${whereClause}
    ORDER BY f.fee_date DESC, f.created_at DESC
    LIMIT ? OFFSET ?
  `
  const list = await db.prepare(listQuery).all(...queryParams, pageSize, (page - 1) * pageSize)
  
  return {
    list: list.map(convertFeeToCamelCase),
    total,
    page,
    pageSize
  }
}

/**
 * 获取费用统计（按类别）
 * 按照服务费分类的父级进行聚合
 * 注意：只统计已审批通过的费用，待审批的费用不计入总额
 */
export async function getFeeStats(params = {}) {
  const db = getDatabase()
  const { billId, startDate, endDate, feeType } = params
  
  // 只统计已审批通过的费用（过滤掉待审批的追加费用）
  let whereClause = "WHERE (f.approval_status IS NULL OR f.approval_status != 'pending')"
  const queryParams = []
  
  if (billId) {
    whereClause += ' AND f.bill_id = ?'
    queryParams.push(billId)
  }
  
  if (startDate) {
    whereClause += ' AND f.fee_date >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    whereClause += ' AND f.fee_date <= ?'
    queryParams.push(endDate)
  }
  
  // 如果指定了费用类型，只统计该类型
  if (feeType) {
    whereClause += ' AND f.fee_type = ?'
    queryParams.push(feeType)
  }
  
  // 按服务费分类的父级进行分组统计
  // 1. 先通过 category 或 fee_name 匹配服务费分类
  // 2. 如果有父级分类，使用父级分类；否则使用自身分类
  // 3. 按父级分类进行聚合统计
  const stats = await db.prepare(`
    WITH fee_with_parent AS (
      SELECT 
        f.id,
        f.category,
        f.fee_name,
        f.amount,
        -- 尝试匹配服务费分类（通过 code 或 name）
        COALESCE(
          sfc_code.id,
          sfc_name.id,
          sfc_fee_name.id
        ) as matched_category_id,
        COALESCE(
          sfc_code.parent_id,
          sfc_name.parent_id,
          sfc_fee_name.parent_id
        ) as parent_id,
        COALESCE(
          sfc_code.name,
          sfc_name.name,
          sfc_fee_name.name,
          f.category
        ) as category_name
      FROM fees f
      LEFT JOIN service_fee_categories sfc_code 
        ON LOWER(sfc_code.code) = LOWER(f.category)
      LEFT JOIN service_fee_categories sfc_name 
        ON LOWER(sfc_name.name) = LOWER(f.category)
      LEFT JOIN service_fee_categories sfc_fee_name 
        ON LOWER(sfc_fee_name.name) = LOWER(f.fee_name)
      ${whereClause}
    ),
    fee_with_final_category AS (
      SELECT 
        fwp.*,
        -- 如果有父级，获取父级分类信息
        COALESCE(
          parent_cat.name,
          fwp.category_name,
          fwp.category
        ) as final_category,
        COALESCE(
          parent_cat.code,
          (SELECT code FROM service_fee_categories WHERE id = fwp.matched_category_id),
          fwp.category
        ) as final_category_code
      FROM fee_with_parent fwp
      LEFT JOIN service_fee_categories parent_cat 
        ON parent_cat.id = fwp.parent_id
    )
    SELECT 
      final_category as category,
      final_category_code as category_code,
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as total
    FROM fee_with_final_category
    GROUP BY final_category, final_category_code
    ORDER BY total DESC
  `).all(...queryParams)
  
  // 按费用类型统计总额（应收/应付）- 使用无别名的 whereClause
  // 只统计未付款的费用（payment_status 不是 'paid'），显示待收/待付金额
  const simpleWhereClause = whereClause.replace(/f\./g, '')
  const receivableResult = await db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
    FROM fees 
    ${simpleWhereClause} AND (fee_type = 'receivable' OR fee_type IS NULL)
    AND (payment_status IS NULL OR payment_status != 'paid')
  `).get(...queryParams)
  
  const payableResult = await db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
    FROM fees 
    ${simpleWhereClause} AND fee_type = 'payable'
    AND (payment_status IS NULL OR payment_status != 'paid')
  `).get(...queryParams)
  
  // 确保数值类型正确（PostgreSQL返回字符串）
  const totalAmount = stats.reduce((sum, s) => sum + Number(s.total || 0), 0)
  const receivableAmount = Number(receivableResult?.total || 0)
  const payableAmount = Number(payableResult?.total || 0)
  
  return {
    byCategory: stats.map(s => ({
      category: s.category,
      categoryCode: s.category_code,  // 添加code用于筛选
      count: Number(s.count || 0),
      total: Number(s.total || 0)
    })),
    totalAmount,
    // 应收/应付分别统计
    receivable: {
      amount: receivableAmount,
      count: Number(receivableResult?.count || 0)
    },
    payable: {
      amount: payableAmount,
      count: Number(payableResult?.count || 0)
    }
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
 * 生成费用编号
 */
async function generateFeeNumber() {
  const db = getDatabase()
  const today = new Date()
  const prefix = `FEE${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`
  
  // 获取当月最大序号
  const result = await db.prepare(`
    SELECT fee_number FROM fees 
    WHERE fee_number LIKE ? 
    ORDER BY fee_number DESC 
    LIMIT 1
  `).get(`${prefix}%`)
  
  if (!result) {
    return `${prefix}0001`
  }
  
  const lastNum = parseInt(result.fee_number.slice(-4), 10)
  return `${prefix}${String(lastNum + 1).padStart(4, '0')}`
}

/**
 * 创建费用
 * 支持追加费用相关字段
 */
export async function createFee(data) {
  const db = getDatabase()
  const id = generateId()
  const feeNumber = await generateFeeNumber()
  
  const result = await db.prepare(`
    INSERT INTO fees (
      id, fee_number, bill_id, bill_number, customer_id, customer_name,
      supplier_id, supplier_name, fee_type,
      category, fee_name, amount, currency, exchange_rate,
      fee_date, description, notes, created_by,
      is_supplementary, approval_status, 
      approval_submitted_at, approval_submitted_by, approval_submitted_by_name,
      approved_at, approved_by, approved_by_name,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    id,
    feeNumber,
    data.billId || null,
    data.billNumber || '',
    data.customerId || null,
    data.customerName || '',
    data.supplierId || null,
    data.supplierName || '',
    data.feeType || 'receivable',
    data.category || 'other',
    data.feeName,
    data.amount,
    data.currency || 'EUR',
    data.exchangeRate || 1,
    data.feeDate || new Date().toISOString().split('T')[0],
    data.description || '',
    data.notes || '',
    data.createdBy || null,
    data.isSupplementary || 0,
    data.approvalStatus || 'approved',
    data.approvalSubmittedAt || null,
    data.approvalSubmittedBy || null,
    data.approvalSubmittedByName || null,
    data.approvedAt || null,
    data.approvedBy || null,
    data.approvedByName || null
  )
  
  return { id, feeNumber }
}

/**
 * 更新费用
 */
export async function updateFee(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    feeType: 'fee_type',
    supplierId: 'supplier_id',
    supplierName: 'supplier_name',
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
  
  fields.push("updated_at = NOW()")
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

/**
 * 根据 billId 和条件删除费用（用于撤销操作时删除自动创建的费用）
 * @param {string} billId - 提单ID
 * @param {Object} conditions - 删除条件
 * @param {string} conditions.feeName - 费用名称
 * @param {string} conditions.notes - 备注（如'系统自动创建'）
 * @returns {number} 删除的记录数
 */
export async function deleteFeeByCondition(billId, conditions = {}) {
  const db = getDatabase()
  
  let query = 'DELETE FROM fees WHERE bill_id = ?'
  const params = [billId]
  
  if (conditions.feeName) {
    query += ' AND fee_name = ?'
    params.push(conditions.feeName)
  }
  
  if (conditions.notes) {
    query += ' AND notes = ?'
    params.push(conditions.notes)
  }
  
  if (conditions.feeType) {
    query += ' AND fee_type = ?'
    params.push(conditions.feeType)
  }
  
  if (conditions.category) {
    query += ' AND category = ?'
    params.push(conditions.category)
  }
  
  const result = await db.prepare(query).run(...params)
  return result.changes
}

// ==================== 提单费用汇总 ====================

/**
 * 获取提单费用汇总
 */
export async function getBillFinanceSummary(billId) {
  const db = getDatabase()
  
  // 获取费用汇总
  const feeStats = getFeeStats({ billId })
  
  // 获取关联发票（排除已删除的）
  const invoices = await db.prepare(`
    SELECT * FROM invoices WHERE bill_id = ? AND (is_deleted IS NULL OR is_deleted = FALSE)
  `).all(billId).map(convertInvoiceToCamelCase)
  
  // 获取关联付款（排除已删除发票的付款）
  const payments = await db.prepare(`
    SELECT * FROM payments 
    WHERE invoice_id IN (SELECT id FROM invoices WHERE bill_id = ? AND (is_deleted IS NULL OR is_deleted = FALSE))
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
  
  // 日期过滤：如果 fee_date 为 null，则使用 created_at 进行过滤
  if (startDate) {
    dateFilter += ' AND (f.fee_date >= ? OR (f.fee_date IS NULL AND DATE(f.created_at) >= ?))'
    queryParams.push(startDate, startDate)
  }
  
  if (endDate) {
    dateFilter += ' AND (f.fee_date <= ? OR (f.fee_date IS NULL AND DATE(f.created_at) <= ?))'
    queryParams.push(endDate, endDate)
  }
  
  // 获取订单维度的费用汇总（关联 bills_of_lading 获取订单号、提单号、集装箱号）
  // 费用分类映射：freight/transport=运费, customs/duty/tax=关税, warehouse/storage=仓储, handling/service=操作费
  // 每个分类分别统计应收(receivable)和应付(payable)
  const stats = await db.prepare(`
    SELECT 
      f.bill_id,
      COALESCE(NULLIF(f.bill_number, ''), b.bill_number) as bill_number,
      b.order_number,
      b.container_number,
      COALESCE(NULLIF(f.customer_id, ''), b.customer_id) as customer_id,
      COALESCE(NULLIF(f.customer_name, ''), b.customer_name) as customer_name,
      COUNT(*) as fee_count,
      COALESCE(SUM(f.amount), 0) as total_amount,
      -- 运费（应收/应付）
      COALESCE(SUM(CASE WHEN f.category IN ('freight', 'transport') AND (f.fee_type = 'receivable' OR f.fee_type IS NULL) THEN f.amount ELSE 0 END), 0) as freight_receivable,
      COALESCE(SUM(CASE WHEN f.category IN ('freight', 'transport') AND f.fee_type = 'payable' THEN f.amount ELSE 0 END), 0) as freight_payable,
      -- 关税（应收/应付）
      COALESCE(SUM(CASE WHEN f.category IN ('customs', 'duty', 'tax') AND (f.fee_type = 'receivable' OR f.fee_type IS NULL) THEN f.amount ELSE 0 END), 0) as customs_receivable,
      COALESCE(SUM(CASE WHEN f.category IN ('customs', 'duty', 'tax') AND f.fee_type = 'payable' THEN f.amount ELSE 0 END), 0) as customs_payable,
      -- 仓储（应收/应付）
      COALESCE(SUM(CASE WHEN f.category IN ('warehouse', 'storage') AND (f.fee_type = 'receivable' OR f.fee_type IS NULL) THEN f.amount ELSE 0 END), 0) as warehouse_receivable,
      COALESCE(SUM(CASE WHEN f.category IN ('warehouse', 'storage') AND f.fee_type = 'payable' THEN f.amount ELSE 0 END), 0) as warehouse_payable,
      -- 操作费（应收/应付）
      COALESCE(SUM(CASE WHEN f.category IN ('handling', 'service') AND (f.fee_type = 'receivable' OR f.fee_type IS NULL) THEN f.amount ELSE 0 END), 0) as handling_receivable,
      COALESCE(SUM(CASE WHEN f.category IN ('handling', 'service') AND f.fee_type = 'payable' THEN f.amount ELSE 0 END), 0) as handling_payable,
      -- 其他（应收/应付）
      COALESCE(SUM(CASE WHEN f.category NOT IN ('freight', 'transport', 'customs', 'duty', 'tax', 'warehouse', 'storage', 'handling', 'service') AND (f.fee_type = 'receivable' OR f.fee_type IS NULL) THEN f.amount ELSE 0 END), 0) as other_receivable,
      COALESCE(SUM(CASE WHEN f.category NOT IN ('freight', 'transport', 'customs', 'duty', 'tax', 'warehouse', 'storage', 'handling', 'service') AND f.fee_type = 'payable' THEN f.amount ELSE 0 END), 0) as other_payable,
      MIN(f.fee_date) as first_fee_date,
      MAX(f.fee_date) as last_fee_date
    FROM fees f
    LEFT JOIN bills_of_lading b ON f.bill_id = b.id
    WHERE f.bill_id IS NOT NULL ${dateFilter}
    GROUP BY f.bill_id, COALESCE(NULLIF(f.bill_number, ''), b.bill_number), b.order_number, b.container_number,
             COALESCE(NULLIF(f.customer_id, ''), b.customer_id), COALESCE(NULLIF(f.customer_name, ''), b.customer_name)
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
      orderNumber: row.order_number,  // 订单号
      containerNumber: row.container_number,  // 集装箱号
      customerId: row.customer_id,
      customerName: row.customer_name,
      feeCount: row.fee_count,
      totalAmount: row.total_amount,
      // 各分类费用（应收/应付分开）
      freightReceivable: row.freight_receivable,
      freightPayable: row.freight_payable,
      customsReceivable: row.customs_receivable,
      customsPayable: row.customs_payable,
      warehouseReceivable: row.warehouse_receivable,
      warehousePayable: row.warehouse_payable,
      handlingReceivable: row.handling_receivable,
      handlingPayable: row.handling_payable,
      otherReceivable: row.other_receivable,
      otherPayable: row.other_payable,
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
  
  // 日期过滤：如果 fee_date 为 null，则使用 created_at 进行过滤
  if (startDate) {
    dateFilter += ' AND (f.fee_date >= ? OR (f.fee_date IS NULL AND DATE(f.created_at) >= ?))'
    queryParams.push(startDate, startDate)
  }
  
  if (endDate) {
    dateFilter += ' AND (f.fee_date <= ? OR (f.fee_date IS NULL AND DATE(f.created_at) <= ?))'
    queryParams.push(endDate, endDate)
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
 * 格式：INV + 年份 + 7位序号，如 INV20250000001
 */
async function generateInvoiceNumber(type) {
  const db = getDatabase()
  const year = new Date().getFullYear()
  const prefix = type === 'sales' ? 'INV' : 'PINV'

  // 获取该年度最大序号
  const result = await db.prepare(`
    SELECT invoice_number FROM invoices
    WHERE invoice_number LIKE ?
    ORDER BY invoice_number DESC LIMIT 1
  `).get(`${prefix}${year}%`)

  let seq = 1
  if (result) {
    // 提取序号部分（年份后的7位数字）
    const numPart = result.invoice_number.replace(`${prefix}${year}`, '')
    const lastSeq = parseInt(numPart) || 0
    seq = lastSeq + 1
  }

  return `${prefix}${year}${String(seq).padStart(7, '0')}`
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
  // 解析 items JSON 字符串
  let parsedItems = []
  if (row.items) {
    try {
      parsedItems = JSON.parse(row.items)
    } catch {
      parsedItems = []
    }
  }
  
  // 解析 fee_ids JSON 字符串
  let parsedFeeIds = []
  if (row.fee_ids) {
    try {
      parsedFeeIds = JSON.parse(row.fee_ids)
    } catch {
      parsedFeeIds = []
    }
  }
  
  // 解析 container_numbers JSON 字符串
  let parsedContainerNumbers = []
  if (row.container_numbers) {
    try {
      parsedContainerNumbers = JSON.parse(row.container_numbers)
    } catch {
      parsedContainerNumbers = []
    }
  }
  
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    invoiceType: row.invoice_type,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerAddress: row.customer_address,
    containerNumbers: parsedContainerNumbers,
    billId: row.bill_id,
    billNumber: row.bill_number,
    subtotal: row.subtotal,
    taxAmount: row.tax_amount,
    totalAmount: row.total_amount,
    paidAmount: row.paid_amount,
    currency: row.currency,
    exchangeRate: row.exchange_rate,
    items: parsedItems,
    feeIds: parsedFeeIds,
    description: row.description,
    notes: row.notes,
    status: row.status,
    language: row.language || 'en',  // 发票语言
    templateId: row.template_id,  // 发票模版ID
    pdfUrl: row.pdf_url,
    excelUrl: row.excel_url,
    pdfGeneratedAt: row.pdf_generated_at,
    excelGeneratedAt: row.excel_generated_at,
    createdBy: row.created_by,
    createTime: row.created_at,
    updateTime: row.updated_at,
    // 追加发票相关字段
    parentInvoiceNumber: row.parent_invoice_number,
    supplementSeq: row.supplement_seq || 0,
    isSupplementInvoice: !!row.parent_invoice_number
  }
}

export function convertPaymentToCamelCase(row) {
  // 解析集装箱号 (来自关联的 invoices 表)
  let containerNumbers = []
  if (row.invoice_container_numbers) {
    try {
      containerNumbers = JSON.parse(row.invoice_container_numbers)
    } catch (e) {
      containerNumbers = []
    }
  }
  
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
    containerNumbers: containerNumbers,  // 集装箱号数组
    amount: row.amount,
    currency: row.currency,
    exchangeRate: row.exchange_rate,
    bankAccount: row.bank_account,
    referenceNumber: row.reference_number,
    description: row.description,
    notes: row.notes,
    status: row.status,
    receiptUrl: row.receipt_url,
    createdBy: row.created_by,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export function convertFeeToCamelCase(row) {
  return {
    id: row.id,
    billId: row.bill_id,
    // 优先使用解析后的提单号（费用本身的 > 关联提单的）
    billNumber: row.resolved_bill_number || row.bill_number,
    orderNumber: row.bill_order_number,  // 订单号（来自关联的 bills_of_lading）
    containerNumber: row.bill_container_number,  // 集装箱号（来自关联的 bills_of_lading）
    // 优先使用解析后的客户信息（费用本身的 > 关联提单的）
    customerId: row.resolved_customer_id || row.customer_id,
    customerName: row.resolved_customer_name || row.customer_name,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    feeType: row.fee_type || 'receivable',
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
    updateTime: row.updated_at,
    // 锁定与审批相关字段
    isLocked: row.is_locked === 1,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    isSupplementary: row.is_supplementary === 1,
    approvalStatus: row.approval_status || 'approved',
    invoiceStatus: row.invoice_status,
    invoicedAmount: row.invoiced_amount || 0,  // 🔥 已开票金额（支持部分开票）
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    approvalSubmittedAt: row.approval_submitted_at,
    approvalSubmittedBy: row.approval_submitted_by,
    approvalSubmittedByName: row.approval_submitted_by_name,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    approvedByName: row.approved_by_name,
    rejectionReason: row.rejection_reason
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
  deleteFeeByCondition,
  
  // 提单财务
  getBillFinanceSummary,
  
  // 报表
  getOrderFeeReport,
  getCustomerFeeReport,
  
  // 转换函数
  convertInvoiceToCamelCase,
  convertPaymentToCamelCase,
  convertFeeToCamelCase,
  
  // 银行账户管理
  getBankAccounts,
  getBankAccountById,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  
  // 财务报表
  getBalanceSheet,
  getIncomeStatement,
  getCashFlowStatement,
  getBusinessAnalysis,
  saveFinancialReport,
  getFinancialReports,
  getFinancialReportById
}

// ==================== 银行账户管理 ====================

/**
 * 获取银行账户列表
 */
export async function getBankAccounts(options = {}) {
  const db = getDatabase()
  const { isActive, currency } = options
  
  let sql = 'SELECT * FROM bank_accounts WHERE 1=1'
  const params = []
  
  if (isActive !== undefined) {
    sql += ' AND is_active = ?'
    params.push(isActive)  // PostgreSQL 直接使用 true/false
  }
  
  if (currency) {
    sql += ' AND currency = ?'
    params.push(currency)
  }
  
  sql += ' ORDER BY is_default DESC, account_name'
  
  const rows = await db.prepare(sql).all(...params)
  return (rows || []).map(formatBankAccount)
}

/**
 * 获取单个银行账户
 */
export async function getBankAccountById(id) {
  const db = getDatabase()
  const row = await db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id)
  return row ? formatBankAccount(row) : null
}

/**
 * 创建银行账户
 */
export async function createBankAccount(data) {
  const db = getDatabase()
  
  // 如果设为默认，先取消其他默认
  if (data.isDefault) {
    await db.prepare('UPDATE bank_accounts SET is_default = FALSE').run()
  }
  
  const result = await db.prepare(`
    INSERT INTO bank_accounts (
      account_name, account_number, bank_name, bank_branch,
      swift_code, iban, currency, account_type, is_default, is_active, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    data.accountName,
    data.accountNumber,
    data.bankName,
    data.bankBranch || '',
    data.swiftCode || '',
    data.iban || '',
    data.currency || 'EUR',
    data.accountType || 'current',
    data.isDefault === true,    // PostgreSQL 使用 true/false
    data.isActive !== false,    // PostgreSQL 使用 true/false
    data.notes || ''
  )
  
  return { id: result?.id || result?.lastInsertRowid }
}

/**
 * 更新银行账户
 */
export async function updateBankAccount(id, data) {
  const db = getDatabase()
  
  // 如果设为默认，先取消其他默认
  if (data.isDefault) {
    await db.prepare('UPDATE bank_accounts SET is_default = FALSE WHERE id != ?').run(id)
  }
  
  const fields = []
  const values = []
  
  const fieldMap = {
    accountName: 'account_name',
    accountNumber: 'account_number',
    bankName: 'bank_name',
    bankBranch: 'bank_branch',
    swiftCode: 'swift_code',
    iban: 'iban',
    currency: 'currency',
    accountType: 'account_type',
    isDefault: 'is_default',
    isActive: 'is_active',
    notes: 'notes'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      // PostgreSQL 直接使用布尔值
      if (jsField === 'isDefault' || jsField === 'isActive') {
        values.push(data[jsField] === true)
      } else {
        values.push(data[jsField])
      }
    }
  })
  
  if (fields.length === 0) return null
  
  fields.push('updated_at = NOW()')
  values.push(id)
  
  await db.prepare(`UPDATE bank_accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return await getBankAccountById(id)
}

/**
 * 删除银行账户
 */
export async function deleteBankAccount(id) {
  const db = getDatabase()
  await db.prepare('DELETE FROM bank_accounts WHERE id = ?').run(id)
  return { success: true }
}

/**
 * 格式化银行账户数据
 */
function formatBankAccount(row) {
  return {
    id: row.id,
    accountName: row.account_name,
    accountNumber: row.account_number,
    bankName: row.bank_name,
    bankBranch: row.bank_branch,
    swiftCode: row.swift_code,
    iban: row.iban,
    currency: row.currency,
    accountType: row.account_type,
    // PostgreSQL 返回的布尔值可能是 true/false 或 1/0
    isDefault: row.is_default === true || row.is_default === 1,
    isActive: row.is_active === true || row.is_active === 1,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ==================== 财务报表 ====================

/**
 * 获取资产负债表数据
 * @param {string} asOfDate - 截止日期 (YYYY-MM-DD)
 */
export async function getBalanceSheet(asOfDate) {
  const db = getDatabase()
  
  // 应收账款（销售发票未收款，排除已删除）
  const receivablesResult = await db.prepare(`
    SELECT 
      COALESCE(SUM(total_amount - paid_amount), 0) as total,
      COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE THEN total_amount - paid_amount ELSE 0 END), 0) as overdue
    FROM invoices 
    WHERE invoice_type = 'sales' 
      AND status NOT IN ('paid', 'cancelled')
      AND (is_deleted IS NULL OR is_deleted = FALSE)
      AND invoice_date <= $1
  `).get(asOfDate)
  
  // 应付账款（采购发票未付款，排除已删除）
  const payablesResult = await db.prepare(`
    SELECT 
      COALESCE(SUM(total_amount - paid_amount), 0) as total,
      COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE THEN total_amount - paid_amount ELSE 0 END), 0) as overdue
    FROM invoices 
    WHERE invoice_type = 'purchase' 
      AND status NOT IN ('paid', 'cancelled')
      AND (is_deleted IS NULL OR is_deleted = FALSE)
      AND invoice_date <= $1
  `).get(asOfDate)
  
  // 银行存款（银行账户余额汇总）- 简化处理，从收付款记录计算
  const cashResult = await db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN payment_type = 'receipt' THEN amount ELSE -amount END), 0) as balance
    FROM payments 
    WHERE status = 'completed'
      AND payment_date <= $1
  `).get(asOfDate)
  
  const receivables = {
    total: Number(receivablesResult?.total || 0),
    overdue: Number(receivablesResult?.overdue || 0)
  }
  
  const payables = {
    total: Number(payablesResult?.total || 0),
    overdue: Number(payablesResult?.overdue || 0)
  }
  
  const bankBalance = Number(cashResult?.balance || 0)
  
  const totalAssets = bankBalance + receivables.total
  const totalLiabilities = payables.total
  const netAssets = totalAssets - totalLiabilities
  
  return {
    asOfDate,
    assets: {
      bankBalance,
      receivables,
      total: totalAssets
    },
    liabilities: {
      payables,
      total: totalLiabilities
    },
    netAssets
  }
}

/**
 * 获取利润表数据
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 */
export async function getIncomeStatement(startDate, endDate) {
  const db = getDatabase()
  
  // 按费用类别统计收入（应收费用）
  const incomeResult = await db.prepare(`
    SELECT 
      COALESCE(fee_category, category, 'other') as category,
      COALESCE(SUM(amount), 0) as amount
    FROM fees 
    WHERE (fee_type = 'receivable' OR fee_type IS NULL)
      AND created_at >= $1 AND created_at <= $2
    GROUP BY COALESCE(fee_category, category, 'other')
  `).all(startDate, endDate + ' 23:59:59')
  
  // 按费用类别统计成本（应付费用）
  const costResult = await db.prepare(`
    SELECT 
      COALESCE(fee_category, category, 'other') as category,
      COALESCE(SUM(amount), 0) as amount
    FROM fees 
    WHERE fee_type = 'payable'
      AND created_at >= $1 AND created_at <= $2
    GROUP BY COALESCE(fee_category, category, 'other')
  `).all(startDate, endDate + ' 23:59:59')
  
  // 整理收入数据
  const incomeByCategory = {}
  let totalIncome = 0
  for (const row of incomeResult) {
    const amount = Number(row.amount || 0)
    incomeByCategory[row.category] = amount
    totalIncome += amount
  }
  
  // 整理成本数据
  const costByCategory = {}
  let totalCost = 0
  for (const row of costResult) {
    const amount = Number(row.amount || 0)
    costByCategory[row.category] = amount
    totalCost += amount
  }
  
  const grossProfit = totalIncome - totalCost
  const grossMargin = totalIncome > 0 ? (grossProfit / totalIncome * 100) : 0
  
  return {
    periodStart: startDate,
    periodEnd: endDate,
    income: {
      byCategory: incomeByCategory,
      total: totalIncome
    },
    cost: {
      byCategory: costByCategory,
      total: totalCost
    },
    grossProfit,
    grossMargin: Math.round(grossMargin * 100) / 100
  }
}

/**
 * 获取现金流量表数据
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 */
export async function getCashFlowStatement(startDate, endDate) {
  const db = getDatabase()
  
  // 期间内收款（现金流入）
  const inflowResult = await db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM payments 
    WHERE payment_type = 'receipt'
      AND status = 'completed'
      AND payment_date >= $1 AND payment_date <= $2
  `).get(startDate, endDate)
  
  // 期间内付款（现金流出）
  const outflowResult = await db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM payments 
    WHERE payment_type = 'payment'
      AND status = 'completed'
      AND payment_date >= $1 AND payment_date <= $2
  `).get(startDate, endDate)
  
  // 期初余额（开始日期之前的收付款净额）
  const beginningResult = await db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN payment_type = 'receipt' THEN amount ELSE -amount END), 0) as balance
    FROM payments 
    WHERE status = 'completed'
      AND payment_date < $1
  `).get(startDate)
  
  const inflow = Number(inflowResult?.total || 0)
  const outflow = Number(outflowResult?.total || 0)
  const netCashFlow = inflow - outflow
  const beginningBalance = Number(beginningResult?.balance || 0)
  const endingBalance = beginningBalance + netCashFlow
  
  return {
    periodStart: startDate,
    periodEnd: endDate,
    operatingActivities: {
      inflow,
      outflow,
      net: netCashFlow
    },
    beginningBalance,
    endingBalance,
    netChange: netCashFlow
  }
}

/**
 * 获取经营分析表数据
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 */
export async function getBusinessAnalysis(startDate, endDate) {
  const db = getDatabase()
  
  // 1. 客户分析
  const customerStats = await db.prepare(`
    SELECT COUNT(DISTINCT id) as total FROM customers
  `).get()
  
  const newCustomers = await db.prepare(`
    SELECT COUNT(*) as count FROM customers 
    WHERE created_at >= $1 AND created_at <= $2
  `).get(startDate, endDate + ' 23:59:59')
  
  // TOP客户（按收入排名）
  const topCustomers = await db.prepare(`
    SELECT 
      customer_id,
      customer_name,
      COALESCE(SUM(amount), 0) as revenue
    FROM fees 
    WHERE (fee_type = 'receivable' OR fee_type IS NULL)
      AND created_at >= $1 AND created_at <= $2
      AND customer_id IS NOT NULL
    GROUP BY customer_id, customer_name
    ORDER BY revenue DESC
    LIMIT 10
  `).all(startDate, endDate + ' 23:59:59')
  
  // 计算TOP5贡献占比
  const totalCustomerRevenue = topCustomers.reduce((sum, c) => sum + Number(c.revenue || 0), 0)
  const top5Revenue = topCustomers.slice(0, 5).reduce((sum, c) => sum + Number(c.revenue || 0), 0)
  const top5Percentage = totalCustomerRevenue > 0 ? (top5Revenue / totalCustomerRevenue * 100) : 0
  
  // 2. 订单分析
  const orderStats = await db.prepare(`
    SELECT COUNT(*) as total_orders
    FROM bills_of_lading b
    WHERE created_at >= $1 AND created_at <= $2
      AND is_void = 0
  `).get(startDate, endDate + ' 23:59:59')
  
  // 计算平均订单金额
  const avgOrderAmount = await db.prepare(`
    SELECT COALESCE(AVG(fee_total), 0) as avg_amount
    FROM (
      SELECT bill_id, SUM(amount) as fee_total
      FROM fees
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY bill_id
    ) as bill_fees
  `).get(startDate, endDate + ' 23:59:59')
  
  const completedOrders = await db.prepare(`
    SELECT COUNT(*) as count FROM bills_of_lading 
    WHERE status = 'completed'
      AND created_at >= $1 AND created_at <= $2
      AND is_void = 0
  `).get(startDate, endDate + ' 23:59:59')
  
  const totalOrders = Number(orderStats?.total_orders || 0)
  const completionRate = totalOrders > 0 ? (Number(completedOrders?.count || 0) / totalOrders * 100) : 0
  
  // 月度订单趋势
  const monthlyOrders = await db.prepare(`
    SELECT 
      TO_CHAR(created_at, 'YYYY-MM') as month,
      COUNT(*) as order_count
    FROM bills_of_lading 
    WHERE created_at >= $1 AND created_at <= $2
      AND is_void = 0
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY month
  `).all(startDate, endDate + ' 23:59:59')
  
  // 3. 盈利能力分析（从利润表获取）
  const incomeStatement = await getIncomeStatement(startDate, endDate)
  
  // 4. 应收账款分析（排除已删除）
  const receivablesAging = await db.prepare(`
    SELECT 
      CASE 
        WHEN due_date >= CURRENT_DATE OR due_date IS NULL THEN '0-30'
        WHEN CURRENT_DATE - due_date <= 30 THEN '0-30'
        WHEN CURRENT_DATE - due_date <= 60 THEN '31-60'
        WHEN CURRENT_DATE - due_date <= 90 THEN '61-90'
        ELSE '90+'
      END as aging,
      COALESCE(SUM(total_amount - paid_amount), 0) as amount
    FROM invoices 
    WHERE invoice_type = 'sales' 
      AND status NOT IN ('paid', 'cancelled')
      AND (is_deleted IS NULL OR is_deleted = FALSE)
    GROUP BY 
      CASE 
        WHEN due_date >= CURRENT_DATE OR due_date IS NULL THEN '0-30'
        WHEN CURRENT_DATE - due_date <= 30 THEN '0-30'
        WHEN CURRENT_DATE - due_date <= 60 THEN '31-60'
        WHEN CURRENT_DATE - due_date <= 90 THEN '61-90'
        ELSE '90+'
      END
  `).all()
  
  // 平均收款周期 - 简化查询（排除已删除）
  const avgCollectionDays = await db.prepare(`
    SELECT COALESCE(AVG(CURRENT_DATE - invoice_date), 0) as avg_days
    FROM invoices
    WHERE invoice_type = 'sales'
      AND invoice_date >= $1 AND invoice_date <= $2
      AND status NOT IN ('paid', 'cancelled')
      AND (is_deleted IS NULL OR is_deleted = FALSE)
  `).get(startDate, endDate)
  
  // 回款率（排除已删除）
  const collectionRate = await db.prepare(`
    SELECT 
      COALESCE(SUM(paid_amount), 0) as collected,
      COALESCE(SUM(total_amount), 0) as total
    FROM invoices 
    WHERE invoice_type = 'sales'
      AND invoice_date >= $1 AND invoice_date <= $2
      AND (is_deleted IS NULL OR is_deleted = FALSE)
  `).get(startDate, endDate)
  
  const collectionRatePercent = Number(collectionRate?.total || 0) > 0 
    ? (Number(collectionRate?.collected || 0) / Number(collectionRate?.total || 0) * 100) 
    : 0
  
  // 5. 供应商分析
  const supplierStats = await db.prepare(`
    SELECT COUNT(DISTINCT id) as total FROM suppliers WHERE status = 'active'
  `).get()
  
  const topSuppliers = await db.prepare(`
    SELECT 
      supplier_id,
      supplier_name,
      COALESCE(SUM(amount), 0) as purchase_amount
    FROM fees 
    WHERE fee_type = 'payable'
      AND created_at >= $1 AND created_at <= $2
      AND supplier_id IS NOT NULL
    GROUP BY supplier_id, supplier_name
    ORDER BY purchase_amount DESC
    LIMIT 10
  `).all(startDate, endDate + ' 23:59:59')
  
  // 6. 趋势对比（与上期对比）
  const periodDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
  const prevStartDate = new Date(new Date(startDate).getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const prevEndDate = new Date(new Date(startDate).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  const prevIncomeStatement = await getIncomeStatement(prevStartDate, prevEndDate)
  
  const prevOrderStats = await db.prepare(`
    SELECT COUNT(*) as total_orders
    FROM bills_of_lading
    WHERE created_at >= $1 AND created_at <= $2
      AND is_void = 0
  `).get(prevStartDate, prevEndDate + ' 23:59:59')
  
  // 计算环比
  const calcChange = (current, previous) => {
    if (!previous || previous === 0) return null
    return Math.round((current - previous) / previous * 10000) / 100
  }
  
  return {
    periodStart: startDate,
    periodEnd: endDate,
    customerAnalysis: {
      totalCustomers: Number(customerStats?.total || 0),
      newCustomers: Number(newCustomers?.count || 0),
      top5Contribution: Math.round(top5Percentage * 100) / 100,
      topCustomers: topCustomers.map((c, i) => ({
        rank: i + 1,
        customerId: c.customer_id,
        customerName: c.customer_name,
        revenue: Number(c.revenue || 0),
        percentage: totalCustomerRevenue > 0 ? Math.round(Number(c.revenue || 0) / totalCustomerRevenue * 10000) / 100 : 0
      }))
    },
    orderAnalysis: {
      totalOrders,
      avgOrderAmount: Math.round(Number(avgOrderAmount?.avg_amount || 0) * 100) / 100,
      completionRate: Math.round(completionRate * 100) / 100,
      monthlyTrend: monthlyOrders.map(m => ({
        month: m.month,
        orderCount: Number(m.order_count || 0)
      }))
    },
    profitAnalysis: {
      totalIncome: incomeStatement.income.total,
      totalCost: incomeStatement.cost.total,
      grossProfit: incomeStatement.grossProfit,
      grossMargin: incomeStatement.grossMargin,
      costBreakdown: Object.entries(incomeStatement.cost.byCategory).map(([category, amount]) => ({
        category,
        amount: Number(amount),
        percentage: incomeStatement.cost.total > 0 ? Math.round(Number(amount) / incomeStatement.cost.total * 10000) / 100 : 0
      }))
    },
    receivablesAnalysis: {
      totalReceivables: receivablesAging.reduce((sum, a) => sum + Number(a.amount || 0), 0),
      avgCollectionDays: Math.round(Number(avgCollectionDays?.avg_days || 0)),
      collectionRate: Math.round(collectionRatePercent * 100) / 100,
      aging: receivablesAging.map(a => ({
        range: a.aging,
        amount: Number(a.amount || 0)
      }))
    },
    supplierAnalysis: {
      totalSuppliers: Number(supplierStats?.total || 0),
      totalPurchase: topSuppliers.reduce((sum, s) => sum + Number(s.purchase_amount || 0), 0),
      topSuppliers: topSuppliers.map((s, i) => ({
        rank: i + 1,
        supplierId: s.supplier_id,
        supplierName: s.supplier_name,
        purchaseAmount: Number(s.purchase_amount || 0)
      }))
    },
    trendComparison: {
      current: {
        income: incomeStatement.income.total,
        cost: incomeStatement.cost.total,
        grossProfit: incomeStatement.grossProfit,
        orders: totalOrders
      },
      previous: {
        income: prevIncomeStatement.income.total,
        cost: prevIncomeStatement.cost.total,
        grossProfit: prevIncomeStatement.grossProfit,
        orders: Number(prevOrderStats?.total_orders || 0)
      },
      change: {
        income: calcChange(incomeStatement.income.total, prevIncomeStatement.income.total),
        cost: calcChange(incomeStatement.cost.total, prevIncomeStatement.cost.total),
        grossProfit: calcChange(incomeStatement.grossProfit, prevIncomeStatement.grossProfit),
        orders: calcChange(totalOrders, Number(prevOrderStats?.total_orders || 0))
      }
    }
  }
}

// ==================== 财务报表历史记录 ====================

/**
 * 保存财务报表记录
 */
export async function saveFinancialReport(data) {
  const db = getDatabase()
  const id = data.id || generateId()
  
  await db.prepare(`
    INSERT INTO financial_reports (
      id, report_type, report_name, period_start, period_end, as_of_date,
      pdf_url, pdf_key, report_data, currency, created_by, created_by_name
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `).run(
    id,
    data.reportType,
    data.reportName,
    data.periodStart || null,
    data.periodEnd || null,
    data.asOfDate || null,
    data.pdfUrl || null,
    data.pdfKey || null,
    JSON.stringify(data.reportData || {}),
    data.currency || 'EUR',
    data.createdBy || null,
    data.createdByName || null
  )
  
  return { id }
}

/**
 * 获取财务报表历史列表
 */
export async function getFinancialReports(params = {}) {
  const db = getDatabase()
  const { reportType, startDate, endDate, page = 1, pageSize = 20 } = params
  
  let whereConditions = ['1=1']
  const queryParams = []
  let paramIndex = 1
  
  if (reportType && reportType !== 'all') {
    whereConditions.push(`report_type = $${paramIndex++}`)
    queryParams.push(reportType)
  }
  
  if (startDate) {
    whereConditions.push(`created_at >= $${paramIndex++}`)
    queryParams.push(startDate)
  }
  
  if (endDate) {
    whereConditions.push(`created_at <= $${paramIndex++}`)
    queryParams.push(endDate + ' 23:59:59')
  }
  
  const whereClause = whereConditions.join(' AND ')
  
  // 获取总数
  const countResult = await db.prepare(`
    SELECT COUNT(*) as total FROM financial_reports WHERE ${whereClause}
  `).get(...queryParams)
  
  // 获取分页数据
  const offset = (page - 1) * pageSize
  const list = await db.prepare(`
    SELECT * FROM financial_reports 
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `).all(...queryParams, pageSize, offset)
  
  return {
    list: list.map(row => ({
      id: row.id,
      reportType: row.report_type,
      reportName: row.report_name,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      asOfDate: row.as_of_date,
      pdfUrl: row.pdf_url,
      pdfKey: row.pdf_key,
      reportData: row.report_data ? JSON.parse(row.report_data) : null,
      currency: row.currency,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at
    })),
    total: parseInt(countResult?.total || 0),
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  }
}

/**
 * 获取单个财务报表
 */
export async function getFinancialReportById(id) {
  const db = getDatabase()
  const row = await db.prepare('SELECT * FROM financial_reports WHERE id = $1').get(id)
  
  if (!row) return null
  
  return {
    id: row.id,
    reportType: row.report_type,
    reportName: row.report_name,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    asOfDate: row.as_of_date,
    pdfUrl: row.pdf_url,
    pdfKey: row.pdf_key,
    reportData: row.report_data ? JSON.parse(row.report_data) : null,
    currency: row.currency,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at
  }
}

// ==================== 提单收款确认 ====================

/**
 * 确认提单收款
 * @param {string} billId - 提单ID
 * @param {Object} data - 确认数据
 */
export async function confirmBillPayment(billId, data) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  await db.prepare(`
    UPDATE bills_of_lading SET
      payment_confirmed = 1,
      payment_confirmed_at = $1,
      payment_confirmed_by = $2,
      payment_confirmed_by_name = $3,
      primary_invoice_number = $4,
      updated_at = $5
    WHERE id = $6
  `).run(
    now,
    data.confirmedBy,
    data.confirmedByName,
    data.primaryInvoiceNumber,
    now,
    billId
  )
  
  return true
}

/**
 * 取消提单收款确认
 * @param {string} billId - 提单ID
 */
export async function cancelBillPaymentConfirm(billId) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  await db.prepare(`
    UPDATE bills_of_lading SET
      payment_confirmed = 0,
      payment_confirmed_at = NULL,
      payment_confirmed_by = NULL,
      payment_confirmed_by_name = NULL,
      updated_at = $1
    WHERE id = $2
  `).run(now, billId)
  
  return true
}

/**
 * 锁定提单费用
 * @param {string} billId - 提单ID
 * @param {string} lockedBy - 锁定人ID
 * @returns {number} 锁定的费用数量
 */
export async function lockBillFees(billId, lockedBy) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 锁定该提单所有已审批通过的费用
  const result = await db.prepare(`
    UPDATE fees SET
      is_locked = 1,
      locked_at = $1,
      locked_by = $2,
      updated_at = $1
    WHERE bill_id = $3 
      AND approval_status = 'approved'
      AND is_locked = 0
  `).run(now, lockedBy, billId)
  
  return result.changes || 0
}

/**
 * 解锁提单费用
 * @param {string} billId - 提单ID
 * @returns {number} 解锁的费用数量
 */
export async function unlockBillFees(billId) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const result = await db.prepare(`
    UPDATE fees SET
      is_locked = 0,
      locked_at = NULL,
      locked_by = NULL,
      updated_at = $1
    WHERE bill_id = $2 AND is_locked = 1
  `).run(now, billId)
  
  return result.changes || 0
}

// ==================== 追加费用审批 ====================

/**
 * 获取待审批的追加费用列表
 */
export async function getPendingApprovalFees(params = {}) {
  const db = getDatabase()
  const { page = 1, pageSize = 20, search } = params
  
  let whereConditions = ["approval_status = 'pending'"]
  const queryParams = []
  let paramIndex = 1
  
  if (search) {
    whereConditions.push(`(
      bill_number LIKE $${paramIndex} OR 
      customer_name LIKE $${paramIndex} OR 
      fee_name LIKE $${paramIndex} OR
      approval_submitted_by_name LIKE $${paramIndex}
    )`)
    queryParams.push(`%${search}%`)
    paramIndex++
  }
  
  const whereClause = whereConditions.join(' AND ')
  
  // 获取总数
  const countResult = await db.prepare(`
    SELECT COUNT(*) as total FROM fees WHERE ${whereClause}
  `).get(...queryParams)
  
  // 获取分页数据
  const offset = (page - 1) * pageSize
  const list = await db.prepare(`
    SELECT * FROM fees 
    WHERE ${whereClause}
    ORDER BY approval_submitted_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `).all(...queryParams, pageSize, offset)
  
  return {
    list: list.map(convertFeeToCamelCase),
    total: parseInt(countResult?.total || 0),
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  }
}

/**
 * 审批通过费用
 */
export async function approveFee(id, approvedBy, approvedByName) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  await db.prepare(`
    UPDATE fees SET
      approval_status = 'approved',
      approved_at = $1,
      approved_by = $2,
      approved_by_name = $3,
      updated_at = $1
    WHERE id = $4
  `).run(now, approvedBy, approvedByName, id)
  
  return true
}

/**
 * 审批拒绝费用
 */
export async function rejectFee(id, approvedBy, approvedByName, reason) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  await db.prepare(`
    UPDATE fees SET
      approval_status = 'rejected',
      approved_at = $1,
      approved_by = $2,
      approved_by_name = $3,
      rejection_reason = $4,
      updated_at = $1
    WHERE id = $5
  `).run(now, approvedBy, approvedByName, reason, id)
  
  return true
}

/**
 * 检查提单是否已确认收款
 */
export async function isBillPaymentConfirmed(billId) {
  const db = getDatabase()
  const result = await db.prepare(`
    SELECT payment_confirmed FROM bills_of_lading WHERE id = $1
  `).get(billId)
  
  return result?.payment_confirmed === 1
}

// ==================== 追加发票编号生成 ====================

/**
 * 生成追加发票编号
 * 格式：主发票号-N（如 INV20250000001-1）
 * @param {string} primaryInvoiceNumber - 主发票号
 * @returns {string} 追加发票号
 */
export async function generateSupplementInvoiceNumber(primaryInvoiceNumber) {
  const db = getDatabase()
  
  // 查询该主发票号已有的追加发票数量
  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM invoices 
    WHERE parent_invoice_number = $1
  `).get(primaryInvoiceNumber)
  
  const seq = (parseInt(result?.count) || 0) + 1
  
  return `${primaryInvoiceNumber}-${seq}`
}

/**
 * 获取提单的主发票号
 * @param {string} billId - 提单ID
 * @returns {string|null} 主发票号
 */
export async function getBillPrimaryInvoiceNumber(billId) {
  const db = getDatabase()
  const result = await db.prepare(`
    SELECT primary_invoice_number FROM bills_of_lading WHERE id = $1
  `).get(billId)
  
  return result?.primary_invoice_number || null
}

/**
 * 创建追加发票
 * @param {Object} data - 发票数据
 * @param {Array} data.feeIds - 关联的费用ID列表（可选）
 * @param {Array} data.items - 发票项目列表（可选）
 * @returns {Object} 创建结果
 */
export async function createSupplementInvoice(data) {
  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()
  const invoiceDate = data.invoiceDate || now.split('T')[0]
  
  // 生成追加发票号
  const invoiceNumber = await generateSupplementInvoiceNumber(data.parentInvoiceNumber)
  
  // 获取追加序号
  const seqResult = await db.prepare(`
    SELECT COALESCE(MAX(supplement_seq), 0) + 1 as next_seq FROM invoices 
    WHERE parent_invoice_number = $1
  `).get(data.parentInvoiceNumber)
  const supplementSeq = seqResult?.next_seq || 1
  
  // 处理集装箱号数组
  const containerNumbers = Array.isArray(data.containerNumbers) 
    ? JSON.stringify(data.containerNumbers) 
    : JSON.stringify([])
  
  // 处理费用ID数组
  const feeIds = Array.isArray(data.feeIds) 
    ? JSON.stringify(data.feeIds) 
    : JSON.stringify([])
  
  // 处理发票项目数组
  const items = Array.isArray(data.items) 
    ? JSON.stringify(data.items) 
    : JSON.stringify([])
  
  await db.prepare(`
    INSERT INTO invoices (
      id, invoice_number, invoice_type, invoice_date, due_date,
      customer_id, customer_name, bill_id, bill_number, container_numbers,
      subtotal, tax_amount, total_amount, paid_amount,
      currency, exchange_rate, description, notes, items, fee_ids,
      status, language, created_by,
      parent_invoice_number, supplement_seq,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW(), NOW())
  `).run(
    id,
    invoiceNumber,
    data.invoiceType || 'sales',
    invoiceDate,
    data.dueDate || null,
    data.customerId || null,
    data.customerName || '',
    data.billId || null,
    data.billNumber || '',
    containerNumbers,
    data.subtotal || 0,
    data.taxAmount || 0,
    data.totalAmount || data.subtotal || 0,
    0, // paid_amount starts at 0
    data.currency || 'EUR',
    data.exchangeRate || 1,
    data.description || '',
    data.notes || '',
    items,
    feeIds,
    data.status || 'issued',
    data.language || 'en',
    data.createdBy || null,
    data.parentInvoiceNumber,
    supplementSeq
  )
  
  // 如果有关联的费用ID，更新费用记录的发票状态（支持部分开票）
  if (Array.isArray(data.feeIds) && data.feeIds.length > 0) {
    // 🔥 构建费用ID到开票金额的映射
    const feeAmountMap = new Map()
    try {
      const parsedItems = typeof data.items === 'string' ? JSON.parse(data.items) : data.items
      if (Array.isArray(parsedItems)) {
        parsedItems.forEach(item => {
          if (item.feeId) {
            const ids = item.feeId.split(',').map(id => id.trim()).filter(id => id)
            const itemAmount = parseFloat(item.finalAmount) || (parseFloat(item.unitPrice || 0) * parseFloat(item.quantity || 1))
            if (ids.length === 1) {
              feeAmountMap.set(ids[0], (feeAmountMap.get(ids[0]) || 0) + itemAmount)
            } else {
              const perFeeAmount = itemAmount / ids.length
              ids.forEach(id => {
                feeAmountMap.set(id, (feeAmountMap.get(id) || 0) + perFeeAmount)
              })
            }
          }
        })
      }
    } catch (e) {
      console.error('[createSupplementaryInvoice] 解析 items 构建金额映射失败:', e)
    }
    
    for (const feeId of data.feeIds) {
      try {
        // 获取当前费用信息
        const fee = await db.prepare(`SELECT amount, invoiced_amount FROM fees WHERE id = ?`).get(feeId)
        if (!fee) continue
        
        const feeAmount = parseFloat(fee.amount) || 0
        const currentInvoicedAmount = parseFloat(fee.invoiced_amount) || 0
        const invoicingAmount = feeAmountMap.get(feeId) || feeAmount
        const newInvoicedAmount = currentInvoicedAmount + invoicingAmount
        const newInvoiceStatus = newInvoicedAmount >= feeAmount ? 'invoiced' : 'partial_invoiced'
        
        await db.prepare(`
          UPDATE fees SET 
            invoiced_amount = ?,
            invoice_status = ?,
            invoice_number = CASE 
              WHEN invoice_number IS NULL OR invoice_number = '' THEN ?
              ELSE invoice_number || ',' || ?
            END,
            invoice_date = ?,
            updated_at = ?
          WHERE id = ?
        `).run(newInvoicedAmount, newInvoiceStatus, invoiceNumber, invoiceNumber, invoiceDate, now, feeId)
      } catch (e) {
        console.error(`[createSupplementaryInvoice] 更新费用 ${feeId} 开票状态失败:`, e)
      }
    }
  }
  
  return { id, invoiceNumber, supplementSeq }
}

