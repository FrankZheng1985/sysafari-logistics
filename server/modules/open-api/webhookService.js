/**
 * Webhook 自动推送服务
 * 在订单状态变更时自动发送通知到客户系统
 */

import crypto from 'crypto'
import fetch from 'node-fetch'
import { getDatabase } from '../../config/database.js'

// Webhook 事件类型
export const WEBHOOK_EVENTS = {
  ORDER_CREATED: 'order.created',           // 订单创建
  ORDER_SHIPPED: 'order.shipped',           // 货物发运
  ORDER_ARRIVED: 'order.arrived',           // 货物到港
  ORDER_CUSTOMS_CLEARED: 'order.customs_cleared',  // 清关放行
  ORDER_DELIVERING: 'order.delivering',     // 开始派送
  ORDER_DELIVERED: 'order.delivered',       // 签收完成
  ORDER_EXCEPTION: 'order.exception',       // 订单异常
  INVOICE_CREATED: 'invoice.created'        // 账单生成
}

// 状态到事件的映射
const STATUS_EVENT_MAP = {
  '草稿': null,
  '待发运': null,
  '已发运': WEBHOOK_EVENTS.ORDER_SHIPPED,
  '运输中': null,
  '已到港': WEBHOOK_EVENTS.ORDER_ARRIVED,
  '清关中': null,
  '已放行': WEBHOOK_EVENTS.ORDER_CUSTOMS_CLEARED,
  '派送中': WEBHOOK_EVENTS.ORDER_DELIVERING,
  '已签收': WEBHOOK_EVENTS.ORDER_DELIVERED,
  '异常': WEBHOOK_EVENTS.ORDER_EXCEPTION
}

/**
 * 当订单状态变更时触发 Webhook
 * @param {string} orderId - 订单ID
 * @param {string} oldStatus - 旧状态
 * @param {string} newStatus - 新状态
 * @param {Object} additionalData - 额外数据
 */
export async function triggerOrderStatusWebhook(orderId, oldStatus, newStatus, additionalData = {}) {
  try {
    const db = getDatabase()
    
    // 获取订单信息
    const order = await db.prepare(`
      SELECT id, external_order_no, bill_number, container_number,
             customer_id, status, callback_url
      FROM bills_of_lading
      WHERE id = ?
    `).get(orderId)
    
    if (!order) {
      console.log(`Webhook: 订单 ${orderId} 不存在`)
      return
    }
    
    // 确定事件类型
    const eventType = STATUS_EVENT_MAP[newStatus]
    if (!eventType) {
      console.log(`Webhook: 状态 ${newStatus} 不需要触发通知`)
      return
    }
    
    // 获取客户的所有活跃 API 密钥
    const apiKeys = await db.prepare(`
      SELECT id, webhook_url, webhook_secret, is_active
      FROM customer_api_keys
      WHERE customer_id = ? AND is_active = true AND webhook_url IS NOT NULL
    `).all(order.customer_id)
    
    // 如果订单有 callback_url，也作为一个发送目标
    const webhookTargets = [...apiKeys]
    if (order.callback_url) {
      webhookTargets.push({
        id: null,
        webhook_url: order.callback_url,
        webhook_secret: null,
        is_order_callback: true
      })
    }
    
    if (webhookTargets.length === 0) {
      console.log(`Webhook: 客户 ${order.customer_id} 没有配置 Webhook`)
      return
    }
    
    // 构造事件数据
    const eventData = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: {
        orderId: order.id,
        externalOrderNo: order.external_order_no,
        billNumber: order.bill_number,
        containerNumber: order.container_number,
        oldStatus,
        newStatus,
        updatedAt: new Date().toISOString(),
        ...additionalData
      }
    }
    
    // 发送到所有 Webhook 目标
    for (const target of webhookTargets) {
      await sendWebhook(target, eventData, order.customer_id)
    }
    
    console.log(`Webhook: 已向 ${webhookTargets.length} 个目标发送 ${eventType} 事件`)
  } catch (error) {
    console.error('触发Webhook失败:', error)
  }
}

/**
 * 当订单创建时触发 Webhook
 */
export async function triggerOrderCreatedWebhook(orderId) {
  try {
    const db = getDatabase()
    
    const order = await db.prepare(`
      SELECT id, external_order_no, bill_number, container_number,
             customer_id, status, callback_url, created_at
      FROM bills_of_lading
      WHERE id = ?
    `).get(orderId)
    
    if (!order) return
    
    await triggerWebhookToCustomer(
      order.customer_id,
      WEBHOOK_EVENTS.ORDER_CREATED,
      {
        orderId: order.id,
        externalOrderNo: order.external_order_no,
        billNumber: order.bill_number,
        containerNumber: order.container_number,
        status: order.status,
        createdAt: order.created_at
      }
    )
  } catch (error) {
    console.error('触发订单创建Webhook失败:', error)
  }
}

/**
 * 当账单创建时触发 Webhook
 */
export async function triggerInvoiceCreatedWebhook(invoiceId, customerId) {
  try {
    const db = getDatabase()
    
    const invoice = await db.prepare(`
      SELECT i.id, i.invoice_number, i.total_amount, i.currency, i.due_date,
             b.id as order_id, b.external_order_no, b.bill_number
      FROM invoices i
      LEFT JOIN bills_of_lading b ON i.bill_id = b.id
      WHERE i.id = ?
    `).get(invoiceId)
    
    if (!invoice) return
    
    await triggerWebhookToCustomer(
      customerId,
      WEBHOOK_EVENTS.INVOICE_CREATED,
      {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        totalAmount: parseFloat(invoice.total_amount),
        currency: invoice.currency,
        dueDate: invoice.due_date,
        orderId: invoice.order_id,
        externalOrderNo: invoice.external_order_no,
        billNumber: invoice.bill_number
      }
    )
  } catch (error) {
    console.error('触发账单创建Webhook失败:', error)
  }
}

/**
 * 发送 Webhook 到客户的所有目标
 */
async function triggerWebhookToCustomer(customerId, eventType, data) {
  const db = getDatabase()
  
  const apiKeys = await db.prepare(`
    SELECT id, webhook_url, webhook_secret
    FROM customer_api_keys
    WHERE customer_id = ? AND is_active = true AND webhook_url IS NOT NULL
  `).all(customerId)
  
  const eventData = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data
  }
  
  for (const key of apiKeys) {
    await sendWebhook(key, eventData, customerId)
  }
}

/**
 * 发送单个 Webhook
 */
async function sendWebhook(target, eventData, customerId) {
  const db = getDatabase()
  const { id: apiKeyId, webhook_url, webhook_secret } = target
  
  try {
    // 生成签名
    const signature = generateSignature(eventData, webhook_secret)
    
    // 发送请求
    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': eventData.event
      },
      body: JSON.stringify(eventData),
      timeout: 10000
    })
    
    const responseStatus = response.status
    let responseBody = ''
    try {
      responseBody = await response.text()
    } catch (e) {}
    
    // 记录日志
    await db.prepare(`
      INSERT INTO webhook_logs (
        api_key_id, customer_id, webhook_url, event_type, payload,
        response_status, response_body, status, sent_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `).run(
      apiKeyId,
      customerId,
      webhook_url,
      eventData.event,
      JSON.stringify(eventData),
      responseStatus,
      responseBody.substring(0, 1000),
      responseStatus >= 200 && responseStatus < 300 ? 'success' : 'failed'
    )
    
    if (responseStatus >= 200 && responseStatus < 300) {
      console.log(`Webhook 发送成功: ${webhook_url} (${eventData.event})`)
    } else {
      console.log(`Webhook 返回错误状态: ${webhook_url} (${responseStatus})`)
    }
  } catch (error) {
    // 记录失败日志
    await db.prepare(`
      INSERT INTO webhook_logs (
        api_key_id, customer_id, webhook_url, event_type, payload,
        status, error_message, created_at
      )
      VALUES (?, ?, ?, ?, ?, 'failed', ?, NOW())
    `).run(
      apiKeyId,
      customerId,
      webhook_url,
      eventData.event,
      JSON.stringify(eventData),
      error.message
    )
    
    console.error(`Webhook 发送失败: ${webhook_url} - ${error.message}`)
  }
}

/**
 * 生成 HMAC-SHA256 签名
 */
function generateSignature(payload, secret) {
  if (!secret) return 'sha256=unsigned'
  
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(JSON.stringify(payload))
  return 'sha256=' + hmac.digest('hex')
}

/**
 * 重试失败的 Webhook（由定时任务调用）
 */
export async function retryFailedWebhooks() {
  const db = getDatabase()
  
  try {
    // 获取需要重试的 Webhook（失败且重试次数小于3）
    const pendingLogs = await db.prepare(`
      SELECT wl.*, ak.webhook_secret
      FROM webhook_logs wl
      LEFT JOIN customer_api_keys ak ON wl.api_key_id = ak.id
      WHERE wl.status = 'failed' AND wl.retry_count < 3
      ORDER BY wl.created_at ASC
      LIMIT 50
    `).all()
    
    for (const log of pendingLogs) {
      try {
        const payload = JSON.parse(log.payload)
        const signature = generateSignature(payload, log.webhook_secret)
        
        const response = await fetch(log.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': log.event_type,
            'X-Webhook-Retry': (log.retry_count + 1).toString()
          },
          body: log.payload,
          timeout: 10000
        })
        
        const newStatus = response.status >= 200 && response.status < 300 ? 'success' : 'failed'
        
        await db.prepare(`
          UPDATE webhook_logs 
          SET retry_count = retry_count + 1, 
              status = ?, 
              response_status = ?,
              sent_at = NOW()
          WHERE id = ?
        `).run(newStatus, response.status, log.id)
        
        if (newStatus === 'success') {
          console.log(`Webhook 重试成功: ${log.webhook_url}`)
        }
      } catch (error) {
        await db.prepare(`
          UPDATE webhook_logs 
          SET retry_count = retry_count + 1, 
              error_message = ?
          WHERE id = ?
        `).run(error.message, log.id)
        
        console.error(`Webhook 重试失败: ${log.webhook_url} - ${error.message}`)
      }
    }
    
    if (pendingLogs.length > 0) {
      console.log(`Webhook 重试: 处理了 ${pendingLogs.length} 条记录`)
    }
  } catch (error) {
    console.error('Webhook 重试任务失败:', error)
  }
}

export default {
  WEBHOOK_EVENTS,
  triggerOrderStatusWebhook,
  triggerOrderCreatedWebhook,
  triggerInvoiceCreatedWebhook,
  retryFailedWebhooks
}

