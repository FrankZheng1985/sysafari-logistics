/**
 * 内部 API 模块 - 控制器
 * 供集团ERP等内部系统对接使用
 */

import { getDatabase } from '../../config/database.js'

/**
 * 健康检查
 */
export async function healthCheck(req, res) {
  try {
    const db = getDatabase()
    await db.prepare('SELECT 1').get()
    
    res.json({
      errCode: 0,
      msg: 'success',
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    })
  } catch (error) {
    res.status(503).json({
      errCode: 503,
      msg: '服务不可用',
      data: { status: 'unhealthy' }
    })
  }
}

// ==================== 订单数据同步接口 ====================

/**
 * 获取订单列表
 */
export async function getOrders(req, res) {
  try {
    const { 
      page = 1, 
      pageSize = 100, 
      startDate, 
      endDate,
      updatedAfter,
      status,
      type = 'history' // history: 已完成, active: 进行中, all: 全部
    } = req.query
    
    const db = getDatabase()
    const offset = (page - 1) * pageSize
    
    // 构建查询条件
    let whereConditions = ['1=1']
    let params = []
    let paramIndex = 1
    
    if (startDate) {
      whereConditions.push(`b.created_at >= $${paramIndex++}`)
      params.push(startDate)
    }
    
    if (endDate) {
      whereConditions.push(`b.created_at <= $${paramIndex++}`)
      params.push(endDate)
    }
    
    if (updatedAfter) {
      whereConditions.push(`b.updated_at > $${paramIndex++}`)
      params.push(updatedAfter)
    }
    
    if (status) {
      whereConditions.push(`b.status = $${paramIndex++}`)
      params.push(status)
    }
    
    if (type === 'history') {
      whereConditions.push(`b.status IN ('delivered', 'completed', 'closed')`)
    } else if (type === 'active') {
      whereConditions.push(`b.status NOT IN ('delivered', 'completed', 'closed', 'cancelled')`)
    }
    
    const whereClause = whereConditions.join(' AND ')
    
    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total FROM bills b WHERE ${whereClause}
    `
    const countResult = await db.prepare(countQuery).get(...params)
    const total = countResult?.total || 0
    
    // 查询列表
    const listQuery = `
      SELECT 
        b.id,
        b.bill_number,
        b.mbl_number,
        b.hbl_number,
        b.container_number,
        b.status,
        b.delivery_status,
        b.transport_mode,
        b.port_of_loading,
        b.port_of_discharge,
        b.etd,
        b.eta,
        b.atd,
        b.ata,
        b.pieces,
        b.weight,
        b.volume,
        b.cbm,
        b.description,
        b.customer_id,
        c.name as customer_name,
        b.shipper_info,
        b.consignee_info,
        b.created_at,
        b.updated_at,
        b.created_by,
        b.assigned_to
      FROM bills b
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE ${whereClause}
      ORDER BY b.updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `
    params.push(pageSize, offset)
    
    const list = await db.prepare(listQuery).all(...params)
    
    // 格式化数据
    const formattedList = list.map(item => ({
      id: item.id,
      billNumber: item.bill_number,
      mblNumber: item.mbl_number,
      hblNumber: item.hbl_number,
      containerNumber: item.container_number,
      status: item.status,
      deliveryStatus: item.delivery_status,
      transportMode: item.transport_mode,
      portOfLoading: item.port_of_loading,
      portOfDischarge: item.port_of_discharge,
      etd: item.etd,
      eta: item.eta,
      atd: item.atd,
      ata: item.ata,
      pieces: item.pieces,
      weight: item.weight,
      volume: item.volume,
      cbm: item.cbm,
      description: item.description,
      customerId: item.customer_id,
      customerName: item.customer_name,
      shipperInfo: item.shipper_info ? JSON.parse(item.shipper_info) : null,
      consigneeInfo: item.consignee_info ? JSON.parse(item.consignee_info) : null,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }))
    
    res.json({
      errCode: 0,
      msg: 'success',
      data: {
        list: formattedList,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / pageSize)
      }
    })
  } catch (error) {
    console.error('获取订单列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取订单列表失败',
      data: null
    })
  }
}

/**
 * 获取订单详情
 */
export async function getOrderDetail(req, res) {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    const order = await db.prepare(`
      SELECT 
        b.*,
        c.name as customer_name,
        u.name as created_by_name
      FROM bills b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.id = $1
    `).get(id)
    
    if (!order) {
      return res.status(404).json({
        errCode: 404,
        msg: '订单不存在',
        data: null
      })
    }
    
    // 获取费用信息
    const fees = await db.prepare(`
      SELECT * FROM bill_fees WHERE bill_id = $1
    `).all(id)
    
    res.json({
      errCode: 0,
      msg: 'success',
      data: {
        ...formatOrder(order),
        fees: fees.map(f => ({
          id: f.id,
          feeType: f.fee_type,
          feeName: f.fee_name,
          amount: f.amount,
          currency: f.currency,
          direction: f.direction // receivable/payable
        }))
      }
    })
  } catch (error) {
    console.error('获取订单详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取订单详情失败',
      data: null
    })
  }
}

/**
 * 获取订单统计
 */
export async function getOrderStats(req, res) {
  try {
    const { startDate, endDate } = req.query
    const db = getDatabase()
    
    let dateFilter = ''
    const params = []
    
    if (startDate) {
      dateFilter += ' AND created_at >= $1'
      params.push(startDate)
    }
    if (endDate) {
      dateFilter += ` AND created_at <= $${params.length + 1}`
      params.push(endDate)
    }
    
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'completed' OR status = 'delivered' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status NOT IN ('completed', 'delivered', 'cancelled', 'closed') THEN 1 END) as active_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        COALESCE(SUM(pieces), 0) as total_pieces,
        COALESCE(SUM(weight), 0) as total_weight,
        COALESCE(SUM(cbm), 0) as total_cbm
      FROM bills
      WHERE 1=1 ${dateFilter}
    `).get(...params)
    
    res.json({
      errCode: 0,
      msg: 'success',
      data: {
        totalOrders: stats.total_orders || 0,
        completedOrders: stats.completed_orders || 0,
        activeOrders: stats.active_orders || 0,
        cancelledOrders: stats.cancelled_orders || 0,
        totalPieces: stats.total_pieces || 0,
        totalWeight: parseFloat(stats.total_weight || 0),
        totalCbm: parseFloat(stats.total_cbm || 0)
      }
    })
  } catch (error) {
    console.error('获取订单统计失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取订单统计失败',
      data: null
    })
  }
}

// ==================== 发票数据同步接口 ====================

/**
 * 获取发票列表
 */
export async function getInvoices(req, res) {
  try {
    const { 
      page = 1, 
      pageSize = 100, 
      startDate, 
      endDate,
      updatedAfter,
      status,
      type // receivable/payable
    } = req.query
    
    const db = getDatabase()
    const offset = (page - 1) * pageSize
    
    let whereConditions = ['1=1']
    let params = []
    let paramIndex = 1
    
    if (startDate) {
      whereConditions.push(`i.created_at >= $${paramIndex++}`)
      params.push(startDate)
    }
    
    if (endDate) {
      whereConditions.push(`i.created_at <= $${paramIndex++}`)
      params.push(endDate)
    }
    
    if (updatedAfter) {
      whereConditions.push(`i.updated_at > $${paramIndex++}`)
      params.push(updatedAfter)
    }
    
    if (status) {
      whereConditions.push(`i.status = $${paramIndex++}`)
      params.push(status)
    }
    
    if (type) {
      whereConditions.push(`i.invoice_type = $${paramIndex++}`)
      params.push(type)
    }
    
    const whereClause = whereConditions.join(' AND ')
    
    // 查询总数
    const countResult = await db.prepare(`
      SELECT COUNT(*) as total FROM invoices i WHERE ${whereClause}
    `).get(...params)
    const total = countResult?.total || 0
    
    // 查询列表
    const listQuery = `
      SELECT 
        i.*,
        c.name as customer_name,
        s.name as supplier_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `
    params.push(pageSize, offset)
    
    const list = await db.prepare(listQuery).all(...params)
    
    res.json({
      errCode: 0,
      msg: 'success',
      data: {
        list: list.map(item => ({
          id: item.id,
          invoiceNumber: item.invoice_number,
          invoiceType: item.invoice_type,
          status: item.status,
          customerId: item.customer_id,
          customerName: item.customer_name,
          supplierId: item.supplier_id,
          supplierName: item.supplier_name,
          amount: parseFloat(item.amount || 0),
          currency: item.currency,
          paidAmount: parseFloat(item.paid_amount || 0),
          dueDate: item.due_date,
          issueDate: item.issue_date,
          billIds: item.bill_ids ? JSON.parse(item.bill_ids) : [],
          createdAt: item.created_at,
          updatedAt: item.updated_at
        })),
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / pageSize)
      }
    })
  } catch (error) {
    console.error('获取发票列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取发票列表失败',
      data: null
    })
  }
}

/**
 * 获取发票详情
 */
export async function getInvoiceDetail(req, res) {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    const invoice = await db.prepare(`
      SELECT 
        i.*,
        c.name as customer_name,
        s.name as supplier_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.id = $1
    `).get(id)
    
    if (!invoice) {
      return res.status(404).json({
        errCode: 404,
        msg: '发票不存在',
        data: null
      })
    }
    
    // 获取发票明细
    const items = await db.prepare(`
      SELECT * FROM invoice_items WHERE invoice_id = $1
    `).all(id)
    
    // 获取付款记录
    const payments = await db.prepare(`
      SELECT * FROM payments WHERE invoice_id = $1
    `).all(id)
    
    res.json({
      errCode: 0,
      msg: 'success',
      data: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        invoiceType: invoice.invoice_type,
        status: invoice.status,
        customerName: invoice.customer_name,
        supplierName: invoice.supplier_name,
        amount: parseFloat(invoice.amount || 0),
        currency: invoice.currency,
        paidAmount: parseFloat(invoice.paid_amount || 0),
        items: items.map(i => ({
          id: i.id,
          description: i.description,
          quantity: i.quantity,
          unitPrice: parseFloat(i.unit_price || 0),
          amount: parseFloat(i.amount || 0)
        })),
        payments: payments.map(p => ({
          id: p.id,
          amount: parseFloat(p.amount || 0),
          paymentDate: p.payment_date,
          paymentMethod: p.payment_method
        })),
        createdAt: invoice.created_at,
        updatedAt: invoice.updated_at
      }
    })
  } catch (error) {
    console.error('获取发票详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取发票详情失败',
      data: null
    })
  }
}

// ==================== 付款数据同步接口 ====================

/**
 * 获取付款记录列表
 */
export async function getPayments(req, res) {
  try {
    const { 
      page = 1, 
      pageSize = 100, 
      startDate, 
      endDate,
      updatedAfter,
      status
    } = req.query
    
    const db = getDatabase()
    const offset = (page - 1) * pageSize
    
    let whereConditions = ['1=1']
    let params = []
    let paramIndex = 1
    
    if (startDate) {
      whereConditions.push(`p.payment_date >= $${paramIndex++}`)
      params.push(startDate)
    }
    
    if (endDate) {
      whereConditions.push(`p.payment_date <= $${paramIndex++}`)
      params.push(endDate)
    }
    
    if (updatedAfter) {
      whereConditions.push(`p.updated_at > $${paramIndex++}`)
      params.push(updatedAfter)
    }
    
    if (status) {
      whereConditions.push(`p.status = $${paramIndex++}`)
      params.push(status)
    }
    
    const whereClause = whereConditions.join(' AND ')
    
    const countResult = await db.prepare(`
      SELECT COUNT(*) as total FROM payments p WHERE ${whereClause}
    `).get(...params)
    const total = countResult?.total || 0
    
    const listQuery = `
      SELECT 
        p.*,
        i.invoice_number
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      WHERE ${whereClause}
      ORDER BY p.payment_date DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `
    params.push(pageSize, offset)
    
    const list = await db.prepare(listQuery).all(...params)
    
    res.json({
      errCode: 0,
      msg: 'success',
      data: {
        list: list.map(item => ({
          id: item.id,
          paymentNumber: item.payment_number,
          invoiceId: item.invoice_id,
          invoiceNumber: item.invoice_number,
          amount: parseFloat(item.amount || 0),
          currency: item.currency,
          paymentMethod: item.payment_method,
          paymentDate: item.payment_date,
          status: item.status,
          bankAccount: item.bank_account,
          reference: item.reference,
          notes: item.notes,
          createdAt: item.created_at,
          updatedAt: item.updated_at
        })),
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / pageSize)
      }
    })
  } catch (error) {
    console.error('获取付款记录失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取付款记录失败',
      data: null
    })
  }
}

/**
 * 获取付款详情
 */
export async function getPaymentDetail(req, res) {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    const payment = await db.prepare(`
      SELECT 
        p.*,
        i.invoice_number,
        c.name as customer_name,
        s.name as supplier_name
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE p.id = $1
    `).get(id)
    
    if (!payment) {
      return res.status(404).json({
        errCode: 404,
        msg: '付款记录不存在',
        data: null
      })
    }
    
    res.json({
      errCode: 0,
      msg: 'success',
      data: {
        id: payment.id,
        paymentNumber: payment.payment_number,
        invoiceId: payment.invoice_id,
        invoiceNumber: payment.invoice_number,
        customerName: payment.customer_name,
        supplierName: payment.supplier_name,
        amount: parseFloat(payment.amount || 0),
        currency: payment.currency,
        paymentMethod: payment.payment_method,
        paymentDate: payment.payment_date,
        status: payment.status,
        bankAccount: payment.bank_account,
        reference: payment.reference,
        notes: payment.notes,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at
      }
    })
  } catch (error) {
    console.error('获取付款详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取付款详情失败',
      data: null
    })
  }
}

// ==================== 统计数据接口 ====================

/**
 * 获取综合统计数据
 */
export async function getStats(req, res) {
  try {
    const db = getDatabase()
    
    // 订单统计
    const orderStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status IN ('completed', 'delivered') THEN 1 END) as completed,
        COUNT(CASE WHEN status NOT IN ('completed', 'delivered', 'cancelled', 'closed') THEN 1 END) as active
      FROM bills
    `).get()
    
    // 本月订单
    const monthlyOrders = await db.prepare(`
      SELECT COUNT(*) as count
      FROM bills
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `).get()
    
    // 应收应付统计
    const arStats = await db.prepare(`
      SELECT 
        COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0) as total
      FROM invoices 
      WHERE invoice_type = 'receivable' AND status != 'paid'
    `).get()
    
    const apStats = await db.prepare(`
      SELECT 
        COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0) as total
      FROM invoices 
      WHERE invoice_type = 'payable' AND status != 'paid'
    `).get()
    
    res.json({
      errCode: 0,
      msg: 'success',
      data: {
        orders: {
          total: orderStats?.total || 0,
          completed: orderStats?.completed || 0,
          active: orderStats?.active || 0,
          monthlyNew: monthlyOrders?.count || 0
        },
        finance: {
          accountsReceivable: parseFloat(arStats?.total || 0),
          accountsPayable: parseFloat(apStats?.total || 0),
          currency: 'EUR'
        },
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('获取统计数据失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取统计数据失败',
      data: null
    })
  }
}

/**
 * 获取财务汇总
 */
export async function getFinancialSummary(req, res) {
  try {
    const { startDate, endDate } = req.query
    const db = getDatabase()
    
    let dateFilter = ''
    const params = []
    
    if (startDate) {
      dateFilter += ' AND created_at >= $1'
      params.push(startDate)
    }
    if (endDate) {
      dateFilter += ` AND created_at <= $${params.length + 1}`
      params.push(endDate)
    }
    
    // 应收款统计
    const receivables = await db.prepare(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(paid_amount), 0) as paid_amount,
        COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0) as outstanding
      FROM invoices
      WHERE invoice_type = 'receivable' ${dateFilter}
    `).get(...params)
    
    // 应付款统计
    const payables = await db.prepare(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(paid_amount), 0) as paid_amount,
        COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0) as outstanding
      FROM invoices
      WHERE invoice_type = 'payable' ${dateFilter}
    `).get(...params)
    
    // 收款记录
    const collections = await db.prepare(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      WHERE i.invoice_type = 'receivable' ${dateFilter.replace(/created_at/g, 'p.payment_date')}
    `).get(...params)
    
    // 付款记录
    const disbursements = await db.prepare(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      WHERE i.invoice_type = 'payable' ${dateFilter.replace(/created_at/g, 'p.payment_date')}
    `).get(...params)
    
    res.json({
      errCode: 0,
      msg: 'success',
      data: {
        receivables: {
          count: receivables?.count || 0,
          totalAmount: parseFloat(receivables?.total_amount || 0),
          paidAmount: parseFloat(receivables?.paid_amount || 0),
          outstanding: parseFloat(receivables?.outstanding || 0)
        },
        payables: {
          count: payables?.count || 0,
          totalAmount: parseFloat(payables?.total_amount || 0),
          paidAmount: parseFloat(payables?.paid_amount || 0),
          outstanding: parseFloat(payables?.outstanding || 0)
        },
        collections: {
          count: collections?.count || 0,
          total: parseFloat(collections?.total || 0)
        },
        disbursements: {
          count: disbursements?.count || 0,
          total: parseFloat(disbursements?.total || 0)
        },
        netPosition: parseFloat((receivables?.outstanding || 0) - (payables?.outstanding || 0)),
        currency: 'EUR',
        period: { startDate, endDate }
      }
    })
  } catch (error) {
    console.error('获取财务汇总失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取财务汇总失败',
      data: null
    })
  }
}

/**
 * 获取月度统计
 */
export async function getMonthlyStats(req, res) {
  try {
    const { months = 12 } = req.query
    const db = getDatabase()
    
    const orderStats = await db.prepare(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as order_count,
        COALESCE(SUM(pieces), 0) as total_pieces,
        COALESCE(SUM(weight), 0) as total_weight
      FROM bills
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '${parseInt(months) - 1} months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month DESC
    `).all()
    
    const revenueStats = await db.prepare(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COALESCE(SUM(CASE WHEN invoice_type = 'receivable' THEN amount ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN invoice_type = 'payable' THEN amount ELSE 0 END), 0) as cost
      FROM invoices
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '${parseInt(months) - 1} months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month DESC
    `).all()
    
    res.json({
      errCode: 0,
      msg: 'success',
      data: {
        orderStats: orderStats.map(s => ({
          month: s.month,
          orderCount: s.order_count,
          totalPieces: s.total_pieces,
          totalWeight: parseFloat(s.total_weight || 0)
        })),
        revenueStats: revenueStats.map(s => ({
          month: s.month,
          revenue: parseFloat(s.revenue || 0),
          cost: parseFloat(s.cost || 0),
          profit: parseFloat((s.revenue || 0) - (s.cost || 0))
        })),
        currency: 'EUR'
      }
    })
  } catch (error) {
    console.error('获取月度统计失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取月度统计失败',
      data: null
    })
  }
}

// ==================== 辅助函数 ====================

function formatOrder(order) {
  return {
    id: order.id,
    billNumber: order.bill_number,
    mblNumber: order.mbl_number,
    hblNumber: order.hbl_number,
    containerNumber: order.container_number,
    status: order.status,
    deliveryStatus: order.delivery_status,
    transportMode: order.transport_mode,
    portOfLoading: order.port_of_loading,
    portOfDischarge: order.port_of_discharge,
    etd: order.etd,
    eta: order.eta,
    atd: order.atd,
    ata: order.ata,
    pieces: order.pieces,
    weight: order.weight,
    volume: order.volume,
    cbm: order.cbm,
    description: order.description,
    customerId: order.customer_id,
    customerName: order.customer_name,
    createdAt: order.created_at,
    updatedAt: order.updated_at
  }
}

export default {
  healthCheck,
  getOrders,
  getOrderDetail,
  getOrderStats,
  getInvoices,
  getInvoiceDetail,
  getPayments,
  getPaymentDetail,
  getStats,
  getFinancialSummary,
  getMonthlyStats
}
