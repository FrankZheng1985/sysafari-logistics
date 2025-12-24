/**
 * 客户门户 API 模块 - 控制器
 * 用于客户门户系统的认证和数据访问
 */

import jwt from 'jsonwebtoken'
import { success, successWithPagination, badRequest, notFound, unauthorized, forbidden, serverError } from '../../utils/response.js'
import * as model from './model.js'
import * as crmModel from '../crm/model.js'

const JWT_SECRET = process.env.JWT_SECRET || 'customer-portal-secret-key'
const JWT_EXPIRES_IN = '24h'

// ==================== 认证接口 ====================

/**
 * 客户门户登录
 */
export async function login(req, res) {
  try {
    const { username, password } = req.body
    
    if (!username || !password) {
      return badRequest(res, '用户名和密码不能为空')
    }
    
    // 验证登录
    const result = await crmModel.verifyCustomerLogin(username, password)
    
    if (!result.success) {
      return unauthorized(res, result.error)
    }
    
    const account = result.account
    
    // 记录登录IP
    const ip = req.ip || req.connection?.remoteAddress
    await crmModel.updateLoginInfo(account.id, ip)
    
    // 生成 JWT Token
    const token = jwt.sign(
      {
        accountId: account.id,
        customerId: account.customerId,
        customerName: account.customerName,
        username: account.username,
        type: 'customer'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )
    
    return success(res, {
      token,
      expiresIn: JWT_EXPIRES_IN,
      user: {
        id: account.id,
        customerId: account.customerId,
        customerName: account.customerName,
        customerCode: account.customerCode,
        username: account.username,
        email: account.email,
        phone: account.phone,
        avatarUrl: account.avatarUrl
      }
    }, '登录成功')
  } catch (error) {
    console.error('客户登录失败:', error)
    return serverError(res, '登录服务暂时不可用')
  }
}

/**
 * 刷新 Token
 */
export async function refreshToken(req, res) {
  try {
    const customer = req.customer
    
    // 生成新 Token
    const token = jwt.sign(
      {
        accountId: customer.accountId,
        customerId: customer.customerId,
        customerName: customer.customerName,
        username: customer.username,
        type: 'customer'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )
    
    return success(res, {
      token,
      expiresIn: JWT_EXPIRES_IN
    })
  } catch (error) {
    console.error('刷新Token失败:', error)
    return serverError(res, '刷新Token失败')
  }
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(req, res) {
  try {
    const account = await crmModel.getCustomerAccountById(req.customer.accountId)
    if (!account) {
      return notFound(res, '账户不存在')
    }
    
    return success(res, {
      id: account.id,
      customerId: account.customerId,
      customerName: account.customerName,
      customerCode: account.customerCode,
      username: account.username,
      email: account.email,
      phone: account.phone,
      avatarUrl: account.avatarUrl,
      lastLoginAt: account.lastLoginAt
    })
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return serverError(res, '获取用户信息失败')
  }
}

/**
 * 修改密码
 */
export async function changePassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body
    const accountId = req.customer.accountId
    
    if (!oldPassword || !newPassword) {
      return badRequest(res, '请提供原密码和新密码')
    }
    
    if (newPassword.length < 8) {
      return badRequest(res, '新密码长度不能少于8位')
    }
    
    // 获取账户信息
    const account = await crmModel.getCustomerAccountByUsername(req.customer.username)
    if (!account) {
      return notFound(res, '账户不存在')
    }
    
    // 验证原密码
    const bcrypt = await import('bcryptjs')
    const isValid = await bcrypt.compare(oldPassword, account.passwordHash)
    if (!isValid) {
      return badRequest(res, '原密码错误')
    }
    
    // 更新密码
    await crmModel.resetCustomerAccountPassword(accountId, newPassword)
    
    return success(res, null, '密码修改成功')
  } catch (error) {
    console.error('修改密码失败:', error)
    return serverError(res, '修改密码失败')
  }
}

// ==================== 订单接口 ====================

/**
 * 获取订单列表
 */
export async function getOrders(req, res) {
  try {
    const customerId = req.customer.customerId
    const { status, billNumber, startDate, endDate, page, pageSize } = req.query
    
    const result = await model.getCustomerOrders(customerId, {
      status,
      billNumber,
      startDate,
      endDate,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取订单列表失败:', error)
    return serverError(res, '获取订单列表失败')
  }
}

/**
 * 获取订单详情
 */
export async function getOrderById(req, res) {
  try {
    const customerId = req.customer.customerId
    const { id } = req.params
    
    const order = await model.getCustomerOrderById(customerId, id)
    if (!order) {
      return notFound(res, '订单不存在')
    }
    
    return success(res, order)
  } catch (error) {
    console.error('获取订单详情失败:', error)
    return serverError(res, '获取订单详情失败')
  }
}

/**
 * 获取订单统计
 */
export async function getOrderStats(req, res) {
  try {
    const customerId = req.customer.customerId
    const stats = await model.getCustomerOrderStats(customerId)
    return success(res, stats)
  } catch (error) {
    console.error('获取订单统计失败:', error)
    return serverError(res, '获取订单统计失败')
  }
}

/**
 * 创建订单草稿
 */
export async function createOrder(req, res) {
  try {
    const customerId = req.customer.customerId
    const orderData = req.body
    
    // 基本验证
    if (!orderData.shipper && !orderData.consignee) {
      return badRequest(res, '发货人或收货人至少填写一个')
    }
    
    const result = await model.createOrderDraft(customerId, orderData)
    
    return success(res, result, '订单创建成功，等待审核')
  } catch (error) {
    console.error('创建订单失败:', error)
    return serverError(res, '创建订单失败')
  }
}

// ==================== 账单接口 ====================

/**
 * 获取账单列表
 */
export async function getInvoices(req, res) {
  try {
    const customerId = req.customer.customerId
    const { status, startDate, endDate, page, pageSize } = req.query
    
    const result = await model.getCustomerInvoices(customerId, {
      status,
      startDate,
      endDate,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取账单列表失败:', error)
    return serverError(res, '获取账单列表失败')
  }
}

/**
 * 获取账单详情
 */
export async function getInvoiceById(req, res) {
  try {
    const customerId = req.customer.customerId
    const { id } = req.params
    
    const invoice = await model.getCustomerInvoiceById(customerId, id)
    if (!invoice) {
      return notFound(res, '账单不存在')
    }
    
    return success(res, invoice)
  } catch (error) {
    console.error('获取账单详情失败:', error)
    return serverError(res, '获取账单详情失败')
  }
}

// ==================== 应付账款接口 ====================

/**
 * 获取应付账款汇总
 */
export async function getPayables(req, res) {
  try {
    const customerId = req.customer.customerId
    const payables = await model.getCustomerPayables(customerId)
    return success(res, payables)
  } catch (error) {
    console.error('获取应付账款失败:', error)
    return serverError(res, '获取应付账款失败')
  }
}

// ==================== API 密钥管理接口 ====================

/**
 * 获取我的 API 密钥列表
 */
export async function getMyApiKeys(req, res) {
  try {
    const customerId = req.customer.customerId
    const keys = await crmModel.getCustomerApiKeys(customerId)
    
    // 隐藏敏感信息
    const safeKeys = keys.map(key => ({
      ...key,
      webhookSecret: key.webhookSecret ? '******' : null
    }))
    
    return success(res, safeKeys)
  } catch (error) {
    console.error('获取API密钥列表失败:', error)
    return serverError(res, '获取API密钥列表失败')
  }
}

/**
 * 创建 API 密钥
 */
export async function createMyApiKey(req, res) {
  try {
    const customerId = req.customer.customerId
    const { keyName, permissions, ipWhitelist, rateLimit, expiresAt, webhookUrl } = req.body
    
    if (!keyName) {
      return badRequest(res, '密钥名称为必填项')
    }
    
    // 限制客户自己创建的密钥权限
    const allowedPermissions = ['order:read', 'order:create', 'invoice:read', 'balance:read']
    const filteredPermissions = (permissions || ['order:read']).filter(p => allowedPermissions.includes(p))
    
    const result = await crmModel.createApiKey({
      customerId,
      keyName,
      permissions: filteredPermissions,
      ipWhitelist,
      rateLimit: Math.min(rateLimit || 100, 100), // 限制最大100次/分钟
      expiresAt,
      webhookUrl,
      createdBy: `customer:${customerId}`
    })
    
    return success(res, {
      id: result.id,
      apiKey: result.apiKey,
      apiSecret: result.apiSecret,
      webhookSecret: result.webhookSecret,
      message: '请妥善保存 API Secret，此信息只显示一次'
    }, 'API密钥创建成功')
  } catch (error) {
    console.error('创建API密钥失败:', error)
    return serverError(res, '创建API密钥失败')
  }
}

/**
 * 更新我的 API 密钥
 */
export async function updateMyApiKey(req, res) {
  try {
    const customerId = req.customer.customerId
    const { id } = req.params
    
    // 验证密钥归属
    const keys = await crmModel.getCustomerApiKeys(customerId)
    const key = keys.find(k => k.id === parseInt(id))
    if (!key) {
      return notFound(res, 'API密钥不存在')
    }
    
    const { keyName, ipWhitelist, webhookUrl, isActive } = req.body
    
    await crmModel.updateApiKey(id, {
      keyName,
      ipWhitelist,
      webhookUrl,
      isActive
    })
    
    return success(res, null, 'API密钥更新成功')
  } catch (error) {
    console.error('更新API密钥失败:', error)
    return serverError(res, '更新API密钥失败')
  }
}

/**
 * 删除我的 API 密钥
 */
export async function deleteMyApiKey(req, res) {
  try {
    const customerId = req.customer.customerId
    const { id } = req.params
    
    // 验证密钥归属
    const keys = await crmModel.getCustomerApiKeys(customerId)
    const key = keys.find(k => k.id === parseInt(id))
    if (!key) {
      return notFound(res, 'API密钥不存在')
    }
    
    await crmModel.deleteApiKey(id)
    
    return success(res, null, 'API密钥删除成功')
  } catch (error) {
    console.error('删除API密钥失败:', error)
    return serverError(res, '删除API密钥失败')
  }
}

/**
 * 获取我的 API 调用日志
 */
export async function getMyApiLogs(req, res) {
  try {
    const customerId = req.customer.customerId
    const { apiKeyId, endpoint, status, startDate, endDate, page, pageSize } = req.query
    
    const result = await crmModel.getApiCallLogs({
      customerId,
      apiKeyId: apiKeyId ? parseInt(apiKeyId) : undefined,
      endpoint,
      status: status ? parseInt(status) : undefined,
      startDate,
      endDate,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 50
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取API调用日志失败:', error)
    return serverError(res, '获取API调用日志失败')
  }
}

// ==================== 认证中间件 ====================

/**
 * 客户门户认证中间件
 */
export function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, '请先登录')
    }
    
    const token = authHeader.substring(7)
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      
      if (decoded.type !== 'customer') {
        return forbidden(res, '无效的访问令牌')
      }
      
      req.customer = decoded
      next()
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return unauthorized(res, '登录已过期，请重新登录')
      }
      return unauthorized(res, '无效的访问令牌')
    }
  } catch (error) {
    console.error('认证失败:', error)
    return serverError(res, '认证服务异常')
  }
}

export default {
  // 认证
  login,
  refreshToken,
  getCurrentUser,
  changePassword,
  
  // 订单
  getOrders,
  getOrderById,
  getOrderStats,
  createOrder,
  
  // 账单
  getInvoices,
  getInvoiceById,
  
  // 应付账款
  getPayables,
  
  // API 密钥
  getMyApiKeys,
  createMyApiKey,
  updateMyApiKey,
  deleteMyApiKey,
  getMyApiLogs,
  
  // 中间件
  authMiddleware
}

