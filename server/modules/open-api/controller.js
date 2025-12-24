/**
 * 开放 API 模块 - 控制器
 * 供客户 ERP/WMS 系统对接使用
 */

import { success, successWithPagination, badRequest, notFound, unauthorized, forbidden, serverError } from '../../utils/response.js'
import * as model from './model.js'
import * as crmModel from '../crm/model.js'
import crypto from 'crypto'
import fetch from 'node-fetch'

// ==================== API 密钥认证中间件 ====================

/**
 * API 密钥认证中间件
 */
export async function apiKeyAuth(req, res, next) {
  const startTime = Date.now()
  
  try {
    const apiKey = req.headers['x-api-key']
    const apiSecret = req.headers['x-api-secret']
    
    if (!apiKey || !apiSecret) {
      await logApiCall(req, null, null, 401, { error: '缺少认证信息' }, startTime)
      return res.status(401).json({
        errCode: 401001,
        errMsg: '缺少 API Key 或 API Secret',
        data: null
      })
    }
    
    // 验证 API 密钥
    const result = await crmModel.verifyApiKey(apiKey, apiSecret)
    
    if (!result.valid) {
      await logApiCall(req, apiKey, null, 401, { error: result.error }, startTime)
      return res.status(401).json({
        errCode: parseInt(result.errorCode) || 401000,
        errMsg: result.error,
        data: null
      })
    }
    
    const keyInfo = result.keyInfo
    
    // 检查 IP 白名单
    if (keyInfo.ipWhitelist && keyInfo.ipWhitelist.length > 0) {
      const clientIp = req.ip || req.connection?.remoteAddress
      const isWhitelisted = checkIpWhitelist(clientIp, keyInfo.ipWhitelist)
      
      if (!isWhitelisted) {
        await logApiCall(req, apiKey, keyInfo.customerId, 403, { error: 'IP 不在白名单' }, startTime)
        return res.status(403).json({
          errCode: 403001,
          errMsg: 'IP 地址不在白名单中',
          data: null
        })
      }
    }
    
    // 检查权限
    const requiredPermission = getRequiredPermission(req.method, req.path)
    if (requiredPermission && !keyInfo.permissions.includes(requiredPermission)) {
      await logApiCall(req, apiKey, keyInfo.customerId, 403, { error: '无权限' }, startTime)
      return res.status(403).json({
        errCode: 403002,
        errMsg: `无权限执行此操作，需要 ${requiredPermission} 权限`,
        data: null
      })
    }
    
    // 更新使用信息
    await crmModel.updateApiKeyUsage(keyInfo.id, req.ip)
    
    // 将客户信息附加到请求
    req.apiKey = keyInfo
    req.customerId = keyInfo.customerId
    req.apiStartTime = startTime
    
    next()
  } catch (error) {
    console.error('API认证失败:', error)
    await logApiCall(req, req.headers['x-api-key'], null, 500, { error: error.message }, startTime)
    return res.status(500).json({
      errCode: 500000,
      errMsg: '认证服务异常',
      data: null
    })
  }
}

/**
 * 检查 IP 是否在白名单中
 */
function checkIpWhitelist(clientIp, whitelist) {
  // 清理 IP 地址格式
  const cleanIp = clientIp?.replace(/^::ffff:/, '') || ''
  
  for (const entry of whitelist) {
    if (entry.includes('/')) {
      // CIDR 格式
      if (isIpInCidr(cleanIp, entry)) return true
    } else {
      // 单个 IP
      if (cleanIp === entry) return true
    }
  }
  
  return false
}

/**
 * 检查 IP 是否在 CIDR 范围内
 */
function isIpInCidr(ip, cidr) {
  const [range, bits] = cidr.split('/')
  const mask = ~(2 ** (32 - parseInt(bits)) - 1)
  
  const ipNum = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0)
  const rangeNum = range.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0)
  
  return (ipNum & mask) === (rangeNum & mask)
}

/**
 * 获取请求所需的权限
 */
function getRequiredPermission(method, path) {
  if (path.includes('/orders')) {
    if (method === 'POST') return 'order:create'
    if (method === 'PUT') return 'order:update'
    return 'order:read'
  }
  if (path.includes('/invoices')) return 'invoice:read'
  if (path.includes('/balance')) return 'balance:read'
  if (path.includes('/webhook')) return 'webhook:manage'
  return null
}

/**
 * 记录 API 调用日志
 */
async function logApiCall(req, apiKey, customerId, status, response, startTime) {
  try {
    await crmModel.logApiCall({
      apiKeyId: req.apiKey?.id,
      customerId: customerId || req.customerId,
      apiKey,
      endpoint: req.path,
      method: req.method,
      requestIp: req.ip,
      requestHeaders: sanitizeHeaders(req.headers),
      requestBody: sanitizeBody(req.body),
      responseStatus: status,
      responseBody: response,
      durationMs: Date.now() - startTime
    })
  } catch (error) {
    console.error('记录API日志失败:', error)
  }
}

/**
 * 脱敏请求头
 */
function sanitizeHeaders(headers) {
  const safe = { ...headers }
  delete safe['x-api-secret']
  delete safe['authorization']
  return safe
}

/**
 * 脱敏请求体
 */
function sanitizeBody(body) {
  if (!body) return null
  const safe = { ...body }
  // 截断过长的内容
  if (JSON.stringify(safe).length > 10000) {
    return { _truncated: true, itemCount: body.orders?.length || Object.keys(body).length }
  }
  return safe
}

// ==================== 订单接口 ====================

/**
 * 批量创建订单
 */
export async function createOrders(req, res) {
  const startTime = req.apiStartTime || Date.now()
  
  try {
    const { orders, callback_url } = req.body
    
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      const response = { errCode: 400001, errMsg: '请提供订单数据', data: null }
      await logApiCall(req, req.apiKey?.apiKey, req.customerId, 400, response, startTime)
      return res.status(400).json(response)
    }
    
    if (orders.length > 100) {
      const response = { errCode: 400002, errMsg: '单次最多创建100个订单', data: null }
      await logApiCall(req, req.apiKey?.apiKey, req.customerId, 400, response, startTime)
      return res.status(400).json(response)
    }
    
    // 验证必填字段
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i]
      if (!order.shipper && !order.consignee) {
        const response = { errCode: 400002, errMsg: `订单 ${i + 1}: 发货人或收货人至少填写一个`, data: null }
        await logApiCall(req, req.apiKey?.apiKey, req.customerId, 400, response, startTime)
        return res.status(400).json(response)
      }
    }
    
    const results = await model.createOrders(req.customerId, orders, callback_url)
    
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    
    const response = {
      errCode: 200,
      errMsg: `创建完成：成功 ${successCount} 个，失败 ${failCount} 个`,
      data: {
        total: orders.length,
        success: successCount,
        failed: failCount,
        results
      }
    }
    
    await logApiCall(req, req.apiKey?.apiKey, req.customerId, 200, { success: successCount, failed: failCount }, startTime)
    return res.json(response)
  } catch (error) {
    console.error('创建订单失败:', error)
    const response = { errCode: 500000, errMsg: '创建订单失败', data: null }
    await logApiCall(req, req.apiKey?.apiKey, req.customerId, 500, { error: error.message }, startTime)
    return res.status(500).json(response)
  }
}

/**
 * 获取订单详情
 */
export async function getOrder(req, res) {
  const startTime = req.apiStartTime || Date.now()
  
  try {
    const { id } = req.params
    
    const order = await model.getOrderDetail(req.customerId, id)
    
    if (!order) {
      const response = { errCode: 404001, errMsg: '订单不存在', data: null }
      await logApiCall(req, req.apiKey?.apiKey, req.customerId, 404, response, startTime)
      return res.status(404).json(response)
    }
    
    const response = { errCode: 200, errMsg: 'success', data: order }
    await logApiCall(req, req.apiKey?.apiKey, req.customerId, 200, { orderId: order.id }, startTime)
    return res.json(response)
  } catch (error) {
    console.error('获取订单详情失败:', error)
    const response = { errCode: 500000, errMsg: '获取订单详情失败', data: null }
    await logApiCall(req, req.apiKey?.apiKey, req.customerId, 500, { error: error.message }, startTime)
    return res.status(500).json(response)
  }
}

/**
 * 更新订单
 */
export async function updateOrder(req, res) {
  const startTime = req.apiStartTime || Date.now()
  
  try {
    const { id } = req.params
    
    const result = await model.updateOrder(req.customerId, id, req.body)
    
    const response = { errCode: 200, errMsg: '更新成功', data: result }
    await logApiCall(req, req.apiKey?.apiKey, req.customerId, 200, result, startTime)
    return res.json(response)
  } catch (error) {
    console.error('更新订单失败:', error)
    const errCode = error.message.includes('不存在') ? 404001 : 400000
    const status = error.message.includes('不存在') ? 404 : 400
    const response = { errCode, errMsg: error.message, data: null }
    await logApiCall(req, req.apiKey?.apiKey, req.customerId, status, { error: error.message }, startTime)
    return res.status(status).json(response)
  }
}

// ==================== 订单状态接口 ====================

/**
 * 批量查询订单状态
 */
export async function getOrdersStatus(req, res) {
  const startTime = req.apiStartTime || Date.now()
  
  try {
    const { updated_after, order_ids, page, pageSize } = req.query
    
    const result = await model.getOrdersStatus(req.customerId, {
      updatedAfter: updated_after,
      orderIds: order_ids ? order_ids.split(',') : undefined,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 50
    })
    
    const response = { errCode: 200, errMsg: 'success', data: result }
    await logApiCall(req, req.apiKey?.apiKey, req.customerId, 200, { count: result.orders.length }, startTime)
    return res.json(response)
  } catch (error) {
    console.error('查询订单状态失败:', error)
    const response = { errCode: 500000, errMsg: '查询订单状态失败', data: null }
    await logApiCall(req, req.apiKey?.apiKey, req.customerId, 500, { error: error.message }, startTime)
    return res.status(500).json(response)
  }
}

/**
 * 获取订单物流跟踪信息
 */
export async function getOrderTracking(req, res) {
  const startTime = req.apiStartTime || Date.now()
  
  try {
    const { id } = req.params
    
    const tracking = await model.getOrderTracking(req.customerId, id)
    
    if (!tracking) {
      const response = { errCode: 404001, errMsg: '订单不存在', data: null }
      await logApiCall(req, req.apiKey?.apiKey, req.customerId, 404, response, startTime)
      return res.status(404).json(response)
    }
    
    const response = { errCode: 200, errMsg: 'success', data: tracking }
    await logApiCall(req, req.apiKey?.apiKey, req.customerId, 200, { orderId: tracking.orderId }, startTime)
    return res.json(response)
  } catch (error) {
    console.error('获取物流跟踪失败:', error)
    const response = { errCode: 500000, errMsg: '获取物流跟踪失败', data: null }
    await logApiCall(req, req.apiKey?.apiKey, req.customerId, 500, { error: error.message }, startTime)
    return res.status(500).json(response)
  }
}

// ==================== 账单接口 ====================

/**
 * 获取账单列表
 */
export async function getInvoices(req, res) {
  const startTime = req.apiStartTime || Date.now()
  
  try {
    const { status, start_date, end_date, page, pageSize } = req.query
    
    const result = await model.getInvoices(req.customerId, {
      status,
      startDate: start_date,
      endDate: end_date,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    const response = { errCode: 200, errMsg: 'success', data: result }
    await logApiCall(req, req.apiKey?.apiKey, req.customerId, 200, { count: result.invoices.length }, startTime)
    return res.json(response)
  } catch (error) {
    console.error('获取账单列表失败:', error)
    const response = { errCode: 500000, errMsg: '获取账单列表失败', data: null }
    await logApiCall(req, req.apiKey?.apiKey, req.customerId, 500, { error: error.message }, startTime)
    return res.status(500).json(response)
  }
}

/**
 * 获取账户余额
 */
export async function getBalance(req, res) {
  const startTime = req.apiStartTime || Date.now()
  
  try {
    const balance = await model.getBalance(req.customerId)
    
    const response = { errCode: 200, errMsg: 'success', data: balance }
    await logApiCall(req, req.apiKey?.apiKey, req.customerId, 200, { balance: balance.balance }, startTime)
    return res.json(response)
  } catch (error) {
    console.error('获取账户余额失败:', error)
    const response = { errCode: 500000, errMsg: '获取账户余额失败', data: null }
    await logApiCall(req, req.apiKey?.apiKey, req.customerId, 500, { error: error.message }, startTime)
    return res.status(500).json(response)
  }
}

// ==================== Webhook 接口 ====================

/**
 * 测试 Webhook 连通性
 */
export async function testWebhook(req, res) {
  const startTime = req.apiStartTime || Date.now()
  
  try {
    const webhookUrl = req.apiKey?.webhookUrl
    const webhookSecret = req.apiKey?.webhookSecret
    
    if (!webhookUrl) {
      const response = { errCode: 400001, errMsg: '未配置 Webhook URL', data: null }
      await logApiCall(req, req.apiKey?.apiKey, req.customerId, 400, response, startTime)
      return res.status(400).json(response)
    }
    
    // 构造测试数据
    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Sysafari Logistics API',
        customerId: req.customerId
      }
    }
    
    // 生成签名
    const signature = generateWebhookSignature(testPayload, webhookSecret)
    
    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature
        },
        body: JSON.stringify(testPayload),
        timeout: 10000
      })
      
      const responseStatus = webhookResponse.status
      let responseBody = ''
      try {
        responseBody = await webhookResponse.text()
      } catch (e) {}
      
      // 记录 Webhook 日志
      await model.logWebhook({
        apiKeyId: req.apiKey?.id,
        customerId: req.customerId,
        webhookUrl,
        eventType: 'webhook.test',
        payload: testPayload,
        responseStatus,
        responseBody: responseBody.substring(0, 1000),
        status: responseStatus >= 200 && responseStatus < 300 ? 'success' : 'failed'
      })
      
      if (responseStatus >= 200 && responseStatus < 300) {
        const response = { 
          errCode: 200, 
          errMsg: 'Webhook 测试成功', 
          data: { 
            url: webhookUrl,
            status: responseStatus,
            message: 'Webhook 连接正常'
          } 
        }
        await logApiCall(req, req.apiKey?.apiKey, req.customerId, 200, response, startTime)
        return res.json(response)
      } else {
        const response = { 
          errCode: 400002, 
          errMsg: `Webhook 返回错误状态: ${responseStatus}`, 
          data: { url: webhookUrl, status: responseStatus }
        }
        await logApiCall(req, req.apiKey?.apiKey, req.customerId, 400, response, startTime)
        return res.status(400).json(response)
      }
    } catch (fetchError) {
      // 记录失败日志
      await model.logWebhook({
        apiKeyId: req.apiKey?.id,
        customerId: req.customerId,
        webhookUrl,
        eventType: 'webhook.test',
        payload: testPayload,
        status: 'failed',
        errorMessage: fetchError.message
      })
      
      const response = { 
        errCode: 400003, 
        errMsg: `Webhook 连接失败: ${fetchError.message}`, 
        data: { url: webhookUrl }
      }
      await logApiCall(req, req.apiKey?.apiKey, req.customerId, 400, response, startTime)
      return res.status(400).json(response)
    }
  } catch (error) {
    console.error('测试Webhook失败:', error)
    const response = { errCode: 500000, errMsg: '测试Webhook失败', data: null }
    await logApiCall(req, req.apiKey?.apiKey, req.customerId, 500, { error: error.message }, startTime)
    return res.status(500).json(response)
  }
}

/**
 * 生成 Webhook 签名
 */
function generateWebhookSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret || '')
  hmac.update(JSON.stringify(payload))
  return 'sha256=' + hmac.digest('hex')
}

/**
 * 发送 Webhook 通知（供内部调用）
 */
export async function sendWebhookNotification(customerId, eventType, data) {
  try {
    // 获取客户的所有活跃 API 密钥
    const apiKeys = await crmModel.getCustomerApiKeys(customerId)
    
    for (const key of apiKeys) {
      if (!key.isActive || !key.webhookUrl) continue
      
      const payload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data
      }
      
      const signature = generateWebhookSignature(payload, key.webhookSecret)
      
      try {
        const response = await fetch(key.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature
          },
          body: JSON.stringify(payload),
          timeout: 10000
        })
        
        await model.logWebhook({
          apiKeyId: key.id,
          customerId,
          webhookUrl: key.webhookUrl,
          eventType,
          payload,
          responseStatus: response.status,
          status: response.status >= 200 && response.status < 300 ? 'success' : 'failed'
        })
      } catch (error) {
        await model.logWebhook({
          apiKeyId: key.id,
          customerId,
          webhookUrl: key.webhookUrl,
          eventType,
          payload,
          status: 'failed',
          errorMessage: error.message
        })
      }
    }
  } catch (error) {
    console.error('发送Webhook通知失败:', error)
  }
}

export default {
  // 中间件
  apiKeyAuth,
  
  // 订单
  createOrders,
  getOrder,
  updateOrder,
  
  // 订单状态
  getOrdersStatus,
  getOrderTracking,
  
  // 账单
  getInvoices,
  getBalance,
  
  // Webhook
  testWebhook,
  sendWebhookNotification
}

