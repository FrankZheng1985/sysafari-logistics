/**
 * 工作台模块 - 数据模型
 * 
 * 注意：所有查询都根据实际数据库结构编写
 * - users 表使用 status 字段而非 is_active
 * - bills 表状态包含中文值（"已完成", "船未到港", "pending" 等）
 * - invoices 表使用 invoice_type 字段
 */

import { getDatabase } from '../../config/database.js'

/**
 * 获取用户工作台配置
 */
export async function getWorkbenchConfig(userId) {
  const db = getDatabase()
  try {
    const row = await db.prepare(
      `SELECT card_order, hidden_cards, created_at, updated_at
       FROM workbench_configs
       WHERE user_id = ?`
    ).get(userId)
    
    if (!row) {
      return null
    }
    
    return {
      cardOrder: row.card_order ? (Array.isArray(row.card_order) ? row.card_order : JSON.parse(row.card_order)) : [],
      hiddenCards: row.hidden_cards ? (Array.isArray(row.hidden_cards) ? row.hidden_cards : JSON.parse(row.hidden_cards)) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  } catch (error) {
    console.error('获取工作台配置出错:', error)
    return null
  }
}

/**
 * 保存用户工作台配置
 */
export async function saveWorkbenchConfig(userId, cardOrder, hiddenCards) {
  const db = getDatabase()
  try {
    const existing = await db.prepare(
      'SELECT id FROM workbench_configs WHERE user_id = ?'
    ).get(userId)
    
    const cardOrderJson = JSON.stringify(cardOrder)
    const hiddenCardsJson = JSON.stringify(hiddenCards)
    
    if (existing) {
      await db.prepare(
        `UPDATE workbench_configs 
         SET card_order = ?, hidden_cards = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`
      ).run(cardOrderJson, hiddenCardsJson, userId)
    } else {
      await db.prepare(
        `INSERT INTO workbench_configs (user_id, card_order, hidden_cards, created_at, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).run(userId, cardOrderJson, hiddenCardsJson)
    }
    
    return { success: true }
  } catch (error) {
    console.error('保存工作台配置出错:', error)
    return { success: false }
  }
}

/**
 * 获取待办任务
 */
export async function getPendingTasks(userId, role) {
  const db = getDatabase()
  const tasks = []
  
  try {
    switch (role) {
      case 'operator':
      case 'doc_clerk':
        // 待更新状态的订单 - 使用实际的状态值
        const pendingOrders = await db.prepare(
          `SELECT COUNT(*) as count FROM bills 
           WHERE status IN ('pending', 'in_progress', '船未到港', '待处理')`
        ).get()
        if (parseInt(pendingOrders?.count) > 0) {
          tasks.push({
            id: 'pending_orders',
            type: 'order',
            title: '待处理订单',
            count: parseInt(pendingOrders.count),
            priority: 'high',
            link: '/bookings/bill',
          })
        }
        break
        
      case 'doc_officer':
        // 单证员 - 检查订单中需要处理的单证
        const pendingDocs = await db.prepare(
          `SELECT COUNT(*) as count FROM bills 
           WHERE status NOT IN ('已完成', 'completed', 'archived', 'cancelled')`
        ).get()
        if (parseInt(pendingDocs?.count) > 0) {
          tasks.push({
            id: 'pending_docs',
            type: 'document',
            title: '待处理单证',
            count: parseInt(pendingDocs.count),
            priority: 'high',
            link: '/documents',
          })
        }
        break
        
      case 'finance_assistant':
        // 待开发票
        const pendingInvoices = await db.prepare(
          `SELECT COUNT(*) as count FROM invoices 
           WHERE status = 'pending'`
        ).get()
        if (parseInt(pendingInvoices?.count) > 0) {
          tasks.push({
            id: 'pending_invoices',
            type: 'invoice',
            title: '待开发票',
            count: parseInt(pendingInvoices.count),
            priority: 'high',
            link: '/finance/invoices',
          })
        }
        
        // 待核销收款
        const pendingPayments = await db.prepare(
          `SELECT COUNT(*) as count FROM payments 
           WHERE status = 'pending'`
        ).get()
        if (parseInt(pendingPayments?.count) > 0) {
          tasks.push({
            id: 'pending_payments',
            type: 'payment',
            title: '待核销收款',
            count: parseInt(pendingPayments.count),
            priority: 'medium',
            link: '/finance/payments',
          })
        }
        break
        
      case 'finance_director':
      case 'manager':
      case 'boss':
      case 'admin':
        // 待审批事项
        try {
          const pendingApprovals = await db.prepare(
            `SELECT COUNT(*) as count FROM unified_approvals 
             WHERE status = 'pending'`
          ).get()
          if (parseInt(pendingApprovals?.count) > 0) {
            tasks.push({
              id: 'pending_approvals',
              type: 'approval',
              title: '待审批事项',
              count: parseInt(pendingApprovals.count),
              priority: 'high',
              link: '/system/approvals',
            })
          }
        } catch (e) {
          // 表可能不存在，忽略
        }
        break
    }
  } catch (error) {
    console.error('获取待办任务出错:', error)
  }
  
  return tasks
}

/**
 * 获取滞留订单预警
 * 已到港超过14天但未完成的订单
 */
export async function getStagnantOrders(userId, role) {
  const db = getDatabase()
  try {
    const rows = await db.prepare(
      `SELECT 
         b.id,
         b.bill_number,
         c.name as customer_name,
         b.ata,
         b.status
       FROM bills b
       LEFT JOIN customers c ON b.customer_id = c.id
       WHERE b.ata IS NOT NULL 
         AND b.ata < CURRENT_DATE - INTERVAL '14 days'
         AND b.status NOT IN ('已完成', 'completed', 'cancelled', 'archived')
       ORDER BY b.ata ASC
       LIMIT 10`
    ).all()
    
    return (rows || []).map(row => ({
      id: row.id,
      billNumber: row.bill_number,
      customerName: row.customer_name,
      ataDate: row.ata,
      daysStagnant: row.ata ? Math.floor((Date.now() - new Date(row.ata).getTime()) / (1000 * 60 * 60 * 24)) : 0,
      pendingAmount: 0,
      status: row.status,
    }))
  } catch (error) {
    console.error('获取滞留订单出错:', error)
    return []
  }
}

/**
 * 获取最近动态
 * 注意：activity_logs 表可能不存在，使用 bills 表的最近更新作为替代
 */
export async function getRecentActivity(userId, limit = 10) {
  const db = getDatabase()
  try {
    // 尝试从 bills 表获取最近更新的订单作为动态
    const rows = await db.prepare(
      `SELECT 
         id,
         bill_number,
         status,
         updated_at as created_at
       FROM bills
       ORDER BY updated_at DESC NULLS LAST
       LIMIT ?`
    ).all(limit)
    
    return (rows || []).map(row => ({
      id: row.id,
      type: 'order',
      title: `订单 ${row.bill_number}`,
      description: `状态: ${row.status}`,
      time: row.created_at,
      link: `/bookings/bill/${row.id}`,
    }))
  } catch (error) {
    console.error('获取最近动态出错:', error)
    return []
  }
}

/**
 * 获取实体链接
 */
function getEntityLink(entityType, entityId) {
  switch (entityType) {
    case 'bill':
    case 'order':
      return `/bookings/bill/${entityId}`
    case 'invoice':
      return `/finance/invoices/${entityId}`
    case 'cmr':
      return `/cmr-manage/${entityId}`
    case 'customer':
      return `/crm/customers/${entityId}`
    default:
      return null
  }
}

/**
 * 获取团队概览
 * 注意：users 表使用 status 字段而非 is_active
 */
export async function getTeamOverview(userId) {
  const db = getDatabase()
  try {
    const rows = await db.prepare(
      `SELECT 
         id,
         name,
         role,
         last_login_time
       FROM users
       WHERE status = 'active'
       ORDER BY last_login_time DESC NULLS LAST
       LIMIT 10`
    ).all()
    
    const members = (rows || []).map(row => {
      let status = 'offline'
      if (row.last_login_time) {
        const lastActive = new Date(row.last_login_time)
        const now = new Date()
        const diffMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60)
        if (diffMinutes <= 5) status = 'online'
        else if (diffMinutes <= 30) status = 'busy'
      }
      
      return {
        id: row.id,
        name: row.name,
        role: row.role,
        roleName: row.role,
        status,
        tasksToday: 0,
        tasksCompleted: 0,
      }
    })
    
    const stats = {
      total: members.length,
      online: members.filter(m => m.status === 'online').length,
      busy: members.filter(m => m.status === 'busy').length,
      offline: members.filter(m => m.status === 'offline').length,
    }
    
    return { members, stats }
  } catch (error) {
    console.error('获取团队概览出错:', error)
    return { members: [], stats: { total: 0, online: 0, busy: 0, offline: 0 } }
  }
}

/**
 * 获取公司概览 - 增强版
 */
export async function getCompanyOverview() {
  const db = getDatabase()
  try {
    // ========== 订单统计 ==========
    // 本月订单数
    const monthlyOrdersResult = await db.prepare(
      `SELECT COUNT(*) as count FROM bills 
       WHERE created_at >= date_trunc('month', CURRENT_DATE)`
    ).get()
    const monthlyOrders = parseInt(monthlyOrdersResult?.count) || 0
    
    // 上月订单数
    const lastMonthOrdersResult = await db.prepare(
      `SELECT COUNT(*) as count FROM bills 
       WHERE created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
       AND created_at < date_trunc('month', CURRENT_DATE)`
    ).get()
    const lastMonthOrders = parseInt(lastMonthOrdersResult?.count) || 0
    
    // 本周订单数
    const weeklyOrdersResult = await db.prepare(
      `SELECT COUNT(*) as count FROM bills 
       WHERE created_at >= date_trunc('week', CURRENT_DATE)`
    ).get()
    const weeklyOrders = parseInt(weeklyOrdersResult?.count) || 0
    
    // 今日订单数
    const todayOrdersResult = await db.prepare(
      `SELECT COUNT(*) as count FROM bills 
       WHERE created_at >= CURRENT_DATE`
    ).get()
    const todayOrders = parseInt(todayOrdersResult?.count) || 0
    
    // 订单增长率
    let monthlyOrdersGrowth = 0
    if (lastMonthOrders > 0) {
      monthlyOrdersGrowth = parseFloat(((monthlyOrders - lastMonthOrders) / lastMonthOrders * 100).toFixed(1))
    } else if (monthlyOrders > 0) {
      monthlyOrdersGrowth = 100
    }
    
    // ========== 收入统计 ==========
    // 本月收入
    const monthlyRevenueResult = await db.prepare(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices 
       WHERE invoice_type = 'sales' AND created_at >= date_trunc('month', CURRENT_DATE)`
    ).get()
    const monthlyRevenue = parseFloat(monthlyRevenueResult?.total) || 0
    
    // 上月收入
    const lastMonthRevenueResult = await db.prepare(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices 
       WHERE invoice_type = 'sales' 
       AND created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
       AND created_at < date_trunc('month', CURRENT_DATE)`
    ).get()
    const lastMonthRevenue = parseFloat(lastMonthRevenueResult?.total) || 0
    
    // 收入增长率
    let monthlyRevenueGrowth = 0
    if (lastMonthRevenue > 0) {
      monthlyRevenueGrowth = parseFloat(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1))
    } else if (monthlyRevenue > 0) {
      monthlyRevenueGrowth = 100
    }
    
    // ========== 应收应付统计 ==========
    // 应收账款余额（未付的销售发票）
    const receivableResult = await db.prepare(
      `SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as balance
       FROM invoices WHERE invoice_type = 'sales' AND status != 'paid'`
    ).get()
    const receivableBalance = parseFloat(receivableResult?.balance) || 0
    
    // 应付账款余额（未付的采购发票）
    const payableResult = await db.prepare(
      `SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as balance
       FROM invoices WHERE invoice_type = 'purchase' AND status != 'paid'`
    ).get()
    const payableBalance = parseFloat(payableResult?.balance) || 0
    
    // ========== 客户统计 ==========
    const customersResult = await db.prepare(
      `SELECT COUNT(*) as total FROM customers WHERE status = 'active'`
    ).get()
    const totalCustomers = parseInt(customersResult?.total) || 0
    
    const newCustomersResult = await db.prepare(
      `SELECT COUNT(*) as count FROM customers 
       WHERE created_at >= date_trunc('month', CURRENT_DATE)`
    ).get()
    const newCustomers = parseInt(newCustomersResult?.count) || 0
    
    // ========== 完成率统计 ==========
    const completedOrdersResult = await db.prepare(
      `SELECT 
         COUNT(*) FILTER (WHERE status IN ('已完成', 'completed', 'archived')) as completed,
         COUNT(*) as total
       FROM bills 
       WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'`
    ).get()
    const completed = parseInt(completedOrdersResult?.completed) || 0
    const total = parseInt(completedOrdersResult?.total) || 0
    const orderCompletionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    
    return {
      // 订单指标
      monthlyOrders,
      monthlyOrdersGrowth,
      weeklyOrders,
      todayOrders,
      // 收入指标
      monthlyRevenue,
      monthlyRevenueGrowth,
      // 应收应付
      receivableBalance,
      payableBalance,
      // 客户指标
      totalCustomers,
      newCustomers,
      // 效率指标
      orderCompletionRate,
      customerSatisfaction: 0,
    }
  } catch (error) {
    console.error('获取公司概览出错:', error)
    return {
      monthlyOrders: 0, monthlyOrdersGrowth: 0, weeklyOrders: 0, todayOrders: 0,
      monthlyRevenue: 0, monthlyRevenueGrowth: 0,
      receivableBalance: 0, payableBalance: 0,
      totalCustomers: 0, newCustomers: 0,
      orderCompletionRate: 0, customerSatisfaction: 0,
    }
  }
}

/**
 * 获取日程安排
 */
export async function getSchedule(userId, date) {
  return []
}

/**
 * 获取订单统计 - 增强版
 */
export async function getOrderStats(userId, role) {
  const db = getDatabase()
  try {
    // ========== 全部订单状态统计 ==========
    const statsResult = await db.prepare(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status IN ('pending', '待处理', '船未到港')) as pending,
         COUNT(*) FILTER (WHERE status IN ('in_progress', '进行中')) as in_progress,
         COUNT(*) FILTER (WHERE status IN ('completed', '已完成', 'archived')) as completed
       FROM bills`
    ).get()
    
    // ========== 时间维度统计 ==========
    // 今日新增
    const todayResult = await db.prepare(
      `SELECT COUNT(*) as count FROM bills WHERE created_at >= CURRENT_DATE`
    ).get()
    
    // 本周新增
    const weekResult = await db.prepare(
      `SELECT COUNT(*) as count FROM bills WHERE created_at >= date_trunc('week', CURRENT_DATE)`
    ).get()
    
    // 本月新增
    const monthResult = await db.prepare(
      `SELECT COUNT(*) as count FROM bills WHERE created_at >= date_trunc('month', CURRENT_DATE)`
    ).get()
    
    // ========== 运输方式统计 ==========
    const transportResult = await db.prepare(
      `SELECT 
         COALESCE(transport_method, '未指定') as method,
         COUNT(*) as count
       FROM bills
       GROUP BY transport_method
       ORDER BY count DESC
       LIMIT 5`
    ).all()
    
    // ========== 港口状态统计 ==========
    const portStatusResult = await db.prepare(
      `SELECT 
         COUNT(*) FILTER (WHERE ship_status = '已到港') as arrived,
         COUNT(*) FILTER (WHERE ship_status = '未到港' OR ship_status IS NULL) as not_arrived
       FROM bills
       WHERE status NOT IN ('已完成', 'completed', 'archived')`
    ).get()
    
    return {
      // 状态统计
      total: parseInt(statsResult?.total) || 0,
      pending: parseInt(statsResult?.pending) || 0,
      inProgress: parseInt(statsResult?.in_progress) || 0,
      completed: parseInt(statsResult?.completed) || 0,
      // 时间维度
      todayNew: parseInt(todayResult?.count) || 0,
      weekNew: parseInt(weekResult?.count) || 0,
      monthNew: parseInt(monthResult?.count) || 0,
      // 运输方式分布
      byTransport: (transportResult || []).map(r => ({
        method: r.method,
        count: parseInt(r.count) || 0
      })),
      // 港口状态
      portArrived: parseInt(portStatusResult?.arrived) || 0,
      portNotArrived: parseInt(portStatusResult?.not_arrived) || 0,
    }
  } catch (error) {
    console.error('获取订单统计出错:', error)
    return {
      total: 0, pending: 0, inProgress: 0, completed: 0,
      todayNew: 0, weekNew: 0, monthNew: 0,
      byTransport: [], portArrived: 0, portNotArrived: 0,
    }
  }
}

/**
 * 获取TMS运输统计 - 增强版
 */
export async function getTmsStats(userId, role) {
  const db = getDatabase()
  try {
    // 运输状态统计（从bills表）
    const statsResult = await db.prepare(
      `SELECT 
         COUNT(*) FILTER (WHERE ship_status = '已到港' 
           AND (delivery_status IS NULL OR delivery_status = '' OR delivery_status = '待派送')
           AND status NOT IN ('已完成', 'completed', 'archived')) as pending,
         COUNT(*) FILTER (WHERE delivery_status = '派送中') as delivering,
         COUNT(*) FILTER (WHERE delivery_status IN ('已送达', '已完成')) as delivered,
         COUNT(*) FILTER (WHERE delivery_status IN ('订单异常', '异常关闭')) as exception
       FROM bills`
    ).get()
    
    // 今日待派送
    const todayPendingResult = await db.prepare(
      `SELECT COUNT(*) as count FROM bills
       WHERE ship_status = '已到港'
         AND (delivery_status IS NULL OR delivery_status = '' OR delivery_status = '待派送')
         AND ata IS NOT NULL AND ata <> ''
         AND ata::DATE >= CURRENT_DATE
         AND status NOT IN ('已完成', 'completed', 'archived')`
    ).get()
    
    // 平均派送时效（已送达订单的 ata 到实际送达的天数）
    const avgDeliveryResult = await db.prepare(
      `SELECT AVG(
         EXTRACT(DAY FROM (updated_at - ata::TIMESTAMP))
       ) as avg_days
       FROM bills
       WHERE delivery_status IN ('已送达', '已完成')
         AND ata IS NOT NULL AND ata <> ''
         AND updated_at IS NOT NULL`
    ).get()
    
    const pending = parseInt(statsResult?.pending) || 0
    const delivering = parseInt(statsResult?.delivering) || 0
    const delivered = parseInt(statsResult?.delivered) || 0
    const exception = parseInt(statsResult?.exception) || 0
    const total = pending + delivering + delivered + exception
    
    return {
      pending,
      delivering,
      delivered,
      exception,
      total,
      todayPending: parseInt(todayPendingResult?.count) || 0,
      avgDeliveryDays: parseFloat(avgDeliveryResult?.avg_days) || 0,
      deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
    }
  } catch (error) {
    console.error('获取TMS统计出错:', error)
    return {
      pending: 0, delivering: 0, delivered: 0, exception: 0,
      total: 0, todayPending: 0, avgDeliveryDays: 0, deliveryRate: 0,
    }
  }
}

/**
 * 获取财务统计 - 增强版
 */
export async function getFinanceStats(userId, role) {
  const db = getDatabase()
  try {
    // ========== 应收应付 ==========
    // 应收账款（sales发票未付金额）
    const receivableResult = await db.prepare(
      `SELECT 
         COALESCE(SUM(total_amount), 0) as total,
         COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as balance,
         COUNT(*) as count
       FROM invoices 
       WHERE invoice_type = 'sales' AND status != 'paid'`
    ).get()
    
    // 应付账款（purchase发票未付金额）
    const payableResult = await db.prepare(
      `SELECT 
         COALESCE(SUM(total_amount), 0) as total,
         COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as balance,
         COUNT(*) as count
       FROM invoices 
       WHERE invoice_type = 'purchase' AND status != 'paid'`
    ).get()
    
    // 逾期应收（超过付款期限的sales发票）
    const overdueReceivableResult = await db.prepare(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as amount
       FROM invoices 
       WHERE invoice_type = 'sales' 
         AND status != 'paid'
         AND due_date < CURRENT_DATE`
    ).get()
    
    // 逾期应付
    const overduePayableResult = await db.prepare(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as amount
       FROM invoices 
       WHERE invoice_type = 'purchase' 
         AND status != 'paid'
         AND due_date < CURRENT_DATE`
    ).get()
    
    // ========== 收支统计 ==========
    // 本月收入
    const monthlyIncomeResult = await db.prepare(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM invoices 
       WHERE invoice_type = 'sales' 
         AND created_at >= date_trunc('month', CURRENT_DATE)`
    ).get()
    
    // 本月支出
    const monthlyExpenseResult = await db.prepare(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM invoices 
       WHERE invoice_type = 'purchase' 
         AND created_at >= date_trunc('month', CURRENT_DATE)`
    ).get()
    
    // 本月费用（从fees表）
    const monthlyFeesResult = await db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM fees 
       WHERE created_at >= date_trunc('month', CURRENT_DATE)`
    ).get()
    
    // 收款率
    const salesTotal = parseFloat(receivableResult?.total) || 0
    const salesPaid = salesTotal - (parseFloat(receivableResult?.balance) || 0)
    const collectionRate = salesTotal > 0 ? Math.round((salesPaid / salesTotal) * 100) : 0
    
    const monthlyIncome = parseFloat(monthlyIncomeResult?.total) || 0
    const monthlyExpense = parseFloat(monthlyExpenseResult?.total) || 0
    const monthlyProfit = monthlyIncome - monthlyExpense
    const profitRate = monthlyIncome > 0 ? Math.round((monthlyProfit / monthlyIncome) * 100) : 0
    
    return {
      // 应收应付
      receivable: parseFloat(receivableResult?.balance) || 0,
      receivableCount: parseInt(receivableResult?.count) || 0,
      payable: parseFloat(payableResult?.balance) || 0,
      payableCount: parseInt(payableResult?.count) || 0,
      // 逾期
      overdueReceivable: parseFloat(overdueReceivableResult?.amount) || 0,
      overdueReceivableCount: parseInt(overdueReceivableResult?.count) || 0,
      overduePayable: parseFloat(overduePayableResult?.amount) || 0,
      overduePayableCount: parseInt(overduePayableResult?.count) || 0,
      // 收支
      monthlyIncome,
      monthlyExpense,
      monthlyProfit,
      monthlyFees: parseFloat(monthlyFeesResult?.total) || 0,
      // 指标
      collectionRate,
      profitRate,
    }
  } catch (error) {
    console.error('获取财务统计出错:', error)
    return {
      receivable: 0, receivableCount: 0, payable: 0, payableCount: 0,
      overdueReceivable: 0, overdueReceivableCount: 0, overduePayable: 0, overduePayableCount: 0,
      monthlyIncome: 0, monthlyExpense: 0, monthlyProfit: 0, monthlyFees: 0,
      collectionRate: 0, profitRate: 0,
    }
  }
}

/**
 * 获取查验统计 - 从bills表
 * 根据 inspection 字段判断是否需要查验
 * inspection 字段值：'-' 表示不查验，'查验' 或其他非空值表示需要查验
 */
export async function getInspectionStats(userId, role) {
  const db = getDatabase()
  try {
    // 从bills表获取查验相关统计
    // inspection 字段不为空且不为 '-' 表示需要查验
    const statsResult = await db.prepare(
      `SELECT 
         COUNT(*) FILTER (
           WHERE inspection IS NOT NULL AND inspection != '-' AND inspection != ''
             AND status NOT IN ('已完成', 'completed', 'archived')
         ) as pending,
         COUNT(*) FILTER (
           WHERE inspection IS NOT NULL AND inspection != '-' AND inspection != ''
             AND status IN ('已完成', 'completed', 'archived')
         ) as released,
         COUNT(*) FILTER (
           WHERE inspection IS NOT NULL AND inspection != '-' AND inspection != ''
         ) as total
       FROM bills`
    ).get()
    
    let pending = parseInt(statsResult?.pending) || 0
    let released = parseInt(statsResult?.released) || 0
    let total = parseInt(statsResult?.total) || 0
    
    // 如果使用 inspection 字段没有数据，尝试用其他字段判断
    // 比如 customs_status = '查验' 也可能表示需要查验
    if (total === 0) {
      const fallbackResult = await db.prepare(
        `SELECT 
           COUNT(*) FILTER (WHERE customs_status LIKE '%查验%') as inspected,
           COUNT(*) FILTER (WHERE customs_status LIKE '%查验%' AND status IN ('已完成', 'completed', 'archived')) as released_count
         FROM bills`
      ).get()
      
      total = parseInt(fallbackResult?.inspected) || 0
      released = parseInt(fallbackResult?.released_count) || 0
      pending = total - released
    }
    
    const releaseRate = total > 0 ? Math.round((released / total) * 100) : 0
    
    return {
      pending,
      inspecting: 0, // 目前没有"查验中"状态的数据
      released,
      total,
      releaseRate,
    }
  } catch (error) {
    console.error('获取查验统计出错:', error)
    return { pending: 0, inspecting: 0, released: 0, total: 0, releaseRate: 0 }
  }
}

/**
 * 获取单证统计
 * 基于 cargo_items 表的匹配状态来统计单证情况
 */
export async function getDocumentStats(userId, role) {
  const db = getDatabase()
  try {
    // 先尝试从 cargo_items 表获取单证匹配统计
    let pendingMatch = 0
    let pendingSupplement = 0
    let completed = 0
    
    try {
      const cargoStats = await db.prepare(
        `SELECT 
           COUNT(DISTINCT bill_id) FILTER (WHERE match_status = 'pending' OR match_status IS NULL) as pending_match,
           COUNT(DISTINCT bill_id) FILTER (WHERE match_status = 'matched') as completed
         FROM cargo_items
         WHERE bill_id IS NOT NULL`
      ).get()
      
      pendingMatch = parseInt(cargoStats?.pending_match) || 0
      completed = parseInt(cargoStats?.completed) || 0
    } catch (e) {
      // cargo_items 表可能不存在或结构不同
    }
    
    // 如果 cargo_items 没有数据，使用订单状态来估算
    if (pendingMatch === 0 && completed === 0) {
      const fallbackResult = await db.prepare(
        `SELECT 
           COUNT(*) FILTER (WHERE status IN ('pending', '待处理', '船未到港')) as pending,
           COUNT(*) FILTER (WHERE status IN ('已完成', 'completed', 'archived')) as done,
           COUNT(*) as total
         FROM bills`
      ).get()
      
      pendingMatch = parseInt(fallbackResult?.pending) || 0
      completed = parseInt(fallbackResult?.done) || 0
    }
    
    const total = pendingMatch + pendingSupplement + completed
    const matchRate = total > 0 
      ? Math.round((completed / total) * 100) 
      : 0
    
    return {
      pendingMatch,
      pendingSupplement,
      completed,
      matchRate,
    }
  } catch (error) {
    console.error('获取单证统计出错:', error)
    return { pendingMatch: 0, pendingSupplement: 0, completed: 0, matchRate: 0 }
  }
}

/**
 * 初始化工作台配置表
 */
export async function initWorkbenchConfigTable() {
  const db = getDatabase()
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS workbench_configs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        card_order TEXT DEFAULT '[]',
        hidden_cards TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `)
    console.log('✅ 工作台配置表初始化完成')
  } catch (error) {
    console.error('初始化工作台配置表失败:', error)
  }
}
