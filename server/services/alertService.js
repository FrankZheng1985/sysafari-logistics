/**
 * 预警服务
 * 检查业务数据，生成预警
 */

import { getDatabase } from '../config/database.js'
import * as messageModel from '../modules/message/model.js'

/**
 * 检查订单超期预警
 * 货物送达客户仓库后超过指定天数未完结单据
 * 
 * 业务背景：防止订单已送达客户仓库，但运营人员没有及时点击完成，
 * 导致财务无法出账单
 * 
 * @param {number} days - 送达后超过多少天未完成触发预警，默认10天
 */
export async function checkOrderOverdue(days = 10) {
  const db = getDatabase()
  
  try {
    // 查找已送达但未完结的订单
    // 条件：
    // 1. 派送状态为"已派送"或"已送达"（表示货物已送到客户仓库）
    // 2. 订单状态不是"已完成"或"已归档"（表示单据未完结）
    // 3. 送达时间超过指定天数（使用卸货完成时间或实际到达时间）
    const overdueOrders = await db.prepare(`
      SELECT 
        id, 
        bill_number, 
        customer_name, 
        delivery_status,
        cmr_unloading_complete_time,
        cmr_actual_arrival_time,
        COALESCE(cmr_unloading_complete_time, cmr_actual_arrival_time)::timestamp as delivered_at
      FROM bills_of_lading
      WHERE delivery_status IN ('已派送', '已送达')
        AND status NOT IN ('已完成', '已归档', 'completed')
        AND is_void = 0
        AND COALESCE(cmr_unloading_complete_time, cmr_actual_arrival_time) IS NOT NULL
        AND COALESCE(cmr_unloading_complete_time, cmr_actual_arrival_time)::timestamp < NOW() - INTERVAL '${days} days'
        AND id NOT IN (
          SELECT related_id FROM alert_logs 
          WHERE alert_type = 'order_overdue' 
            AND status = 'active'
            AND related_type = 'order'
        )
    `).all()
    
    const alerts = []
    for (const order of overdueOrders) {
      const deliveredDate = order.delivered_at ? new Date(order.delivered_at).toLocaleDateString() : '-'
      const daysSinceDelivery = order.delivered_at 
        ? Math.floor((Date.now() - new Date(order.delivered_at).getTime()) / (1000 * 60 * 60 * 24))
        : days
      
      const alert = {
        ruleId: 'rule-order-overdue',
        ruleName: '订单超期未完结',
        alertType: 'order_overdue',
        alertLevel: daysSinceDelivery > 15 ? 'danger' : 'warning',  // 超过15天升级为危险
        title: `订单 ${order.bill_number} 送达后未完结`,
        content: `订单 ${order.bill_number} (客户: ${order.customer_name || '-'}) 已于 ${deliveredDate} 送达客户仓库，距今 ${daysSinceDelivery} 天，请及时完结单据以便财务出账。`,
        relatedType: 'order',
        relatedId: order.id
      }
      
      await messageModel.createAlertLog(alert)
      alerts.push(alert)
    }
    
    return { success: true, count: alerts.length, alerts }
  } catch (error) {
    console.error('检查订单超期失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 检查应收逾期预警
 * 发票到期未收款
 */
export async function checkPaymentDue() {
  const db = getDatabase()
  
  try {
    // 查找逾期未收款的发票
    const overdueInvoices = await db.prepare(`
      SELECT id, invoice_number, customer_name, total_amount, due_date
      FROM invoices
      WHERE status = 'pending'
        AND invoice_type = 'sales'
        AND due_date < CURRENT_DATE
        AND id NOT IN (
          SELECT related_id FROM alert_logs 
          WHERE alert_type = 'payment_due' 
            AND status = 'active'
            AND related_type = 'invoice'
        )
    `).all()
    
    const alerts = []
    for (const invoice of overdueInvoices) {
      const alert = {
        ruleId: 'rule-payment-due',
        ruleName: '应收逾期预警',
        alertType: 'payment_due',
        alertLevel: 'danger',
        title: `发票 ${invoice.invoice_number} 已逾期`,
        content: `发票 ${invoice.invoice_number} (客户: ${invoice.customer_name || '-'}) 金额 ${invoice.total_amount} EUR，到期日 ${invoice.due_date}，已逾期。`,
        relatedType: 'invoice',
        relatedId: invoice.id
      }
      
      await messageModel.createAlertLog(alert)
      alerts.push(alert)
    }
    
    return { success: true, count: alerts.length, alerts }
  } catch (error) {
    console.error('检查应收逾期失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 检查信用超限预警
 * 客户欠款超过信用额度
 */
export async function checkCreditLimit() {
  const db = getDatabase()
  
  try {
    // 查找信用超限的客户
    const overLimitCustomers = await db.prepare(`
      SELECT 
        c.id, 
        c.company_name,
        c.credit_limit,
        COALESCE(SUM(i.total_amount - i.paid_amount), 0) as outstanding
      FROM customers c
      LEFT JOIN invoices i ON i.customer_id = c.id AND i.status = 'pending' AND i.invoice_type = 'sales'
      WHERE c.credit_limit > 0
      GROUP BY c.id, c.company_name, c.credit_limit
      HAVING COALESCE(SUM(i.total_amount - i.paid_amount), 0) > c.credit_limit
    `).all()
    
    const alerts = []
    for (const customer of overLimitCustomers) {
      // 检查是否已有活跃预警
      const existingAlert = await db.prepare(`
        SELECT id FROM alert_logs 
        WHERE alert_type = 'credit_limit' 
          AND status = 'active'
          AND related_type = 'customer'
          AND related_id = $1
      `).get(customer.id)
      
      if (!existingAlert) {
        const alert = {
          ruleId: 'rule-credit-limit',
          ruleName: '信用超限预警',
          alertType: 'credit_limit',
          alertLevel: 'danger',
          title: `客户 ${customer.company_name} 信用超限`,
          content: `客户 ${customer.company_name} 欠款 ${customer.outstanding} EUR，已超过信用额度 ${customer.credit_limit} EUR。`,
          relatedType: 'customer',
          relatedId: customer.id
        }
        
        await messageModel.createAlertLog(alert)
        alerts.push(alert)
      }
    }
    
    return { success: true, count: alerts.length, alerts }
  } catch (error) {
    console.error('检查信用超限失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 检查合同到期预警
 * 合同到期前指定天数提醒
 */
export async function checkContractExpire(days = 30) {
  const db = getDatabase()
  
  try {
    // 查找即将到期的合同
    const expiringContracts = await db.prepare(`
      SELECT id, contract_number, customer_name, end_date
      FROM contracts
      WHERE status = 'active'
        AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${days} days'
        AND id NOT IN (
          SELECT related_id FROM alert_logs 
          WHERE alert_type = 'contract_expire' 
            AND status IN ('active', 'handled')
            AND related_type = 'contract'
        )
    `).all()
    
    const alerts = []
    for (const contract of expiringContracts) {
      const daysLeft = Math.ceil((new Date(contract.end_date) - new Date()) / (1000 * 60 * 60 * 24))
      const alert = {
        ruleId: 'rule-contract-expire',
        ruleName: '合同到期预警',
        alertType: 'contract_expire',
        alertLevel: 'info',
        title: `合同 ${contract.contract_number} 即将到期`,
        content: `合同 ${contract.contract_number} (客户: ${contract.customer_name || '-'}) 将于 ${contract.end_date} 到期，还有 ${daysLeft} 天。`,
        relatedType: 'contract',
        relatedId: contract.id
      }
      
      await messageModel.createAlertLog(alert)
      alerts.push(alert)
    }
    
    return { success: true, count: alerts.length, alerts }
  } catch (error) {
    console.error('检查合同到期失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 检查账期即将到期预警
 * 发票即将在指定天数内到期
 */
export async function checkPaymentTermDue(days = 7) {
  const db = getDatabase()
  
  try {
    // 查找即将到期的发票（未到期但即将到期）
    const dueSoonInvoices = await db.prepare(`
      SELECT 
        i.id, 
        i.invoice_number, 
        i.customer_id,
        i.customer_name, 
        i.total_amount,
        i.paid_amount,
        i.due_date,
        c.payment_terms
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.status = 'pending'
        AND i.invoice_type = 'sales'
        AND i.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${days} days'
        AND i.id NOT IN (
          SELECT related_id FROM alert_logs 
          WHERE alert_type = 'payment_term_due' 
            AND status IN ('active', 'handled')
            AND related_type = 'invoice'
        )
    `).all()
    
    const alerts = []
    for (const invoice of dueSoonInvoices) {
      const daysLeft = Math.ceil((new Date(invoice.due_date) - new Date()) / (1000 * 60 * 60 * 24))
      const outstanding = invoice.total_amount - (invoice.paid_amount || 0)
      
      const alert = {
        ruleId: 'rule-payment-term-due',
        ruleName: '账期即将到期预警',
        alertType: 'payment_term_due',
        alertLevel: daysLeft <= 3 ? 'warning' : 'info',
        title: `发票 ${invoice.invoice_number} 账期即将到期`,
        content: `发票 ${invoice.invoice_number} (客户: ${invoice.customer_name || '-'}) 待收金额 ${outstanding.toFixed(2)} EUR，将于 ${invoice.due_date} 到期，还有 ${daysLeft} 天。${invoice.payment_terms ? '账期: ' + invoice.payment_terms : ''}`,
        relatedType: 'invoice',
        relatedId: invoice.id
      }
      
      await messageModel.createAlertLog(alert)
      alerts.push(alert)
    }
    
    return { success: true, count: alerts.length, alerts }
  } catch (error) {
    console.error('检查账期即将到期失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 检查客户多笔逾期预警
 * 客户有多笔发票逾期未付
 */
export async function checkCustomerOverdueCount(minCount = 2) {
  const db = getDatabase()
  
  try {
    // 查找有多笔逾期的客户
    const overdueCustomers = await db.prepare(`
      SELECT 
        c.id,
        c.company_name,
        c.payment_terms,
        c.credit_limit,
        COUNT(i.id) as overdue_count,
        SUM(i.total_amount - COALESCE(i.paid_amount, 0)) as total_overdue
      FROM customers c
      INNER JOIN invoices i ON i.customer_id = c.id
      WHERE i.status = 'pending'
        AND i.invoice_type = 'sales'
        AND i.due_date < CURRENT_DATE
      GROUP BY c.id, c.company_name, c.payment_terms, c.credit_limit
      HAVING COUNT(i.id) >= ${minCount}
    `).all()
    
    const alerts = []
    for (const customer of overdueCustomers) {
      // 检查是否已有活跃预警
      const existingAlert = await db.prepare(`
        SELECT id FROM alert_logs 
        WHERE alert_type = 'customer_overdue' 
          AND status = 'active'
          AND related_type = 'customer'
          AND related_id = $1
      `).get(customer.id)
      
      if (!existingAlert) {
        const alert = {
          ruleId: 'rule-customer-overdue',
          ruleName: '客户多笔逾期预警',
          alertType: 'customer_overdue',
          alertLevel: 'danger',
          title: `客户 ${customer.company_name} 有 ${customer.overdue_count} 笔逾期`,
          content: `客户 ${customer.company_name} 有 ${customer.overdue_count} 笔发票逾期未付，逾期总金额 ${Number(customer.total_overdue || 0).toFixed(2)} EUR。${customer.payment_terms ? '客户账期: ' + customer.payment_terms : ''}`,
          relatedType: 'customer',
          relatedId: customer.id
        }
        
        await messageModel.createAlertLog(alert)
        alerts.push(alert)
      }
    }
    
    return { success: true, count: alerts.length, alerts }
  } catch (error) {
    console.error('检查客户多笔逾期失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 检查供应商合同到期预警
 */
export async function checkSupplierContractExpire(days = 30) {
  const db = getDatabase()
  
  try {
    // 查找供应商合同即将到期
    // contract_expire_date 是 TEXT 类型，需要转换为 DATE 进行比较
    const expiringSuppliers = await db.prepare(`
      SELECT id, supplier_code, supplier_name, contract_expire_date
      FROM suppliers
      WHERE status = 'active'
        AND contract_expire_date IS NOT NULL
        AND contract_expire_date != ''
        AND contract_expire_date::DATE BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${days} days'
        AND id NOT IN (
          SELECT related_id FROM alert_logs 
          WHERE alert_type = 'license_expire' 
            AND status IN ('active', 'handled')
            AND related_type = 'supplier'
        )
    `).all()
    
    const alerts = []
    for (const supplier of expiringSuppliers) {
      const daysLeft = Math.ceil((new Date(supplier.contract_expire_date) - new Date()) / (1000 * 60 * 60 * 24))
      const alert = {
        ruleId: 'rule-license-expire',
        ruleName: '证照到期预警',
        alertType: 'license_expire',
        alertLevel: 'info',
        title: `供应商 ${supplier.supplier_name} 合同即将到期`,
        content: `供应商 ${supplier.supplier_name} (${supplier.supplier_code}) 合同将于 ${supplier.contract_expire_date} 到期，还有 ${daysLeft} 天。`,
        relatedType: 'supplier',
        relatedId: supplier.id
      }
      
      await messageModel.createAlertLog(alert)
      alerts.push(alert)
    }
    
    return { success: true, count: alerts.length, alerts }
  } catch (error) {
    console.error('检查供应商合同到期失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 运行所有预警检查
 */
export async function runAllChecks() {
  console.log('🔔 开始预警检查...')
  
  const results = {
    orderOverdue: await checkOrderOverdue(30),
    paymentDue: await checkPaymentDue(),
    paymentTermDue: await checkPaymentTermDue(7),  // 账期即将到期（7天内）
    customerOverdue: await checkCustomerOverdueCount(2),  // 客户多笔逾期（>=2笔）
    creditLimit: await checkCreditLimit(),
    contractExpire: await checkContractExpire(30),
    supplierContractExpire: await checkSupplierContractExpire(30)
  }
  
  const totalAlerts = Object.values(results).reduce((sum, r) => sum + (r.count || 0), 0)
  console.log(`✅ 预警检查完成，共生成 ${totalAlerts} 条预警`)
  
  return results
}

export default {
  checkOrderOverdue,
  checkPaymentDue,
  checkPaymentTermDue,
  checkCustomerOverdueCount,
  checkCreditLimit,
  checkContractExpire,
  checkSupplierContractExpire,
  runAllChecks
}
