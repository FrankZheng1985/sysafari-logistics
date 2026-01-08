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
 * 获取公司概览
 */
export async function getCompanyOverview() {
  const db = getDatabase()
  try {
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
    
    // 计算增长率
    let monthlyOrdersGrowth = 0
    if (lastMonthOrders > 0) {
      monthlyOrdersGrowth = parseFloat(((monthlyOrders - lastMonthOrders) / lastMonthOrders * 100).toFixed(1))
    } else if (monthlyOrders > 0) {
      monthlyOrdersGrowth = 100
    }
    
    // 本月收入 (invoice_type 而非 type)
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
    
    // 计算增长率
    let monthlyRevenueGrowth = 0
    if (lastMonthRevenue > 0) {
      monthlyRevenueGrowth = parseFloat(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1))
    } else if (monthlyRevenue > 0) {
      monthlyRevenueGrowth = 100
    }
    
    // 客户统计 (status = 'active')
    const customersResult = await db.prepare(
      `SELECT COUNT(*) as total FROM customers WHERE status = 'active'`
    ).get()
    const totalCustomers = parseInt(customersResult?.total) || 0
    
    const newCustomersResult = await db.prepare(
      `SELECT COUNT(*) as count FROM customers 
       WHERE created_at >= date_trunc('month', CURRENT_DATE)`
    ).get()
    const newCustomers = parseInt(newCustomersResult?.count) || 0
    
    // 订单完成率 (使用中文状态 "已完成")
    const completedOrdersResult = await db.prepare(
      `SELECT 
         COUNT(*) FILTER (WHERE status IN ('已完成', 'completed', 'archived')) as completed,
         COUNT(*) as total
       FROM bills 
       WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'`
    ).get()
    const completed = parseInt(completedOrdersResult?.completed) || 0
    const total = parseInt(completedOrdersResult?.total) || 1
    const orderCompletionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    
    return {
      monthlyOrders,
      monthlyOrdersGrowth,
      monthlyRevenue,
      monthlyRevenueGrowth,
      totalCustomers,
      newCustomers,
      orderCompletionRate,
      customerSatisfaction: 0,
    }
  } catch (error) {
    console.error('获取公司概览出错:', error)
    return {
      monthlyOrders: 0,
      monthlyOrdersGrowth: 0,
      monthlyRevenue: 0,
      monthlyRevenueGrowth: 0,
      totalCustomers: 0,
      newCustomers: 0,
      orderCompletionRate: 0,
      customerSatisfaction: 0,
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
