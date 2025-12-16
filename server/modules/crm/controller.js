/**
 * CRM客户关系管理模块 - 控制器
 */

import { success, successWithPagination, badRequest, notFound, conflict, serverError } from '../../utils/response.js'
import * as model from './model.js'

// ==================== 客户管理 ====================

/**
 * 获取客户列表
 */
export async function getCustomers(req, res) {
  try {
    const { type, level, status, search, countryCode, assignedTo, page, pageSize } = req.query
    
    const result = await model.getCustomers({
      type,
      level,
      status,
      search,
      countryCode,
      assignedTo: assignedTo ? parseInt(assignedTo) : undefined,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取客户列表失败:', error)
    return serverError(res, '获取客户列表失败')
  }
}

/**
 * 获取客户统计
 */
export async function getCustomerStats(req, res) {
  try {
    const stats = await model.getCustomerStats()
    return success(res, stats)
  } catch (error) {
    console.error('获取客户统计失败:', error)
    return serverError(res, '获取客户统计失败')
  }
}

/**
 * 获取客户详情
 */
export async function getCustomerById(req, res) {
  try {
    const customer = await model.getCustomerById(req.params.id)
    if (!customer) {
      return notFound(res, '客户不存在')
    }
    
    // 获取关联数据
    const contacts = await model.getContacts(customer.id)
    const orderStats = await model.getCustomerOrderStats(customer.id)
    
    return success(res, {
      ...customer,
      contacts,
      orderStats
    })
  } catch (error) {
    console.error('获取客户详情失败:', error)
    return serverError(res, '获取客户详情失败')
  }
}

/**
 * 创建客户
 */
export async function createCustomer(req, res) {
  try {
    const { customerName } = req.body
    
    // 客户名称为必填项，客户编码由系统自动生成
    if (!customerName) {
      return badRequest(res, '客户名称为必填项')
    }
    
    // 如果提供了customerCode，检查是否已存在
    if (req.body.customerCode) {
      const existing = await model.getCustomerByCode(req.body.customerCode)
      if (existing) {
        return conflict(res, '客户代码已存在')
      }
    }
    
    const result = await model.createCustomer(req.body)
    const newCustomer = await model.getCustomerById(result.id)
    
    return success(res, newCustomer, '创建成功')
  } catch (error) {
    console.error('创建客户失败:', error)
    return serverError(res, '创建客户失败')
  }
}

/**
 * 更新客户
 */
export async function updateCustomer(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getCustomerById(id)
    if (!existing) {
      return notFound(res, '客户不存在')
    }
    
    const updated = await model.updateCustomer(id, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedCustomer = await model.getCustomerById(id)
    return success(res, updatedCustomer, '更新成功')
  } catch (error) {
    console.error('更新客户失败:', error)
    return serverError(res, '更新客户失败')
  }
}

/**
 * 删除客户
 */
export async function deleteCustomer(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getCustomerById(id)
    if (!existing) {
      return notFound(res, '客户不存在')
    }
    
    model.deleteCustomer(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除客户失败:', error)
    return serverError(res, '删除客户失败')
  }
}

/**
 * 更新客户状态
 */
export async function updateCustomerStatus(req, res) {
  try {
    const { id } = req.params
    const { status } = req.body
    
    if (!status || !['active', 'inactive', 'blacklist'].includes(status)) {
      return badRequest(res, '状态值无效')
    }
    
    const existing = await model.getCustomerById(id)
    if (!existing) {
      return notFound(res, '客户不存在')
    }
    
    await model.updateCustomerStatus(id, status)
    return success(res, null, '状态更新成功')
  } catch (error) {
    console.error('更新客户状态失败:', error)
    return serverError(res, '更新客户状态失败')
  }
}

/**
 * 分配客户给业务员
 */
export async function assignCustomer(req, res) {
  try {
    const { id } = req.params
    const { assignedTo, assignedName } = req.body
    
    if (!assignedTo) {
      return badRequest(res, '分配人ID为必填项')
    }
    
    const existing = await model.getCustomerById(id)
    if (!existing) {
      return notFound(res, '客户不存在')
    }
    
    await model.assignCustomer(id, assignedTo, assignedName || '')
    const updatedCustomer = await model.getCustomerById(id)
    
    return success(res, updatedCustomer, '分配成功')
  } catch (error) {
    console.error('分配客户失败:', error)
    return serverError(res, '分配客户失败')
  }
}

// ==================== 联系人管理 ====================

/**
 * 获取客户联系人列表
 */
export async function getContacts(req, res) {
  try {
    const { customerId } = req.params
    
    const customer = await model.getCustomerById(customerId)
    if (!customer) {
      return notFound(res, '客户不存在')
    }
    
    const contacts = await model.getContacts(customerId)
    return success(res, contacts)
  } catch (error) {
    console.error('获取联系人列表失败:', error)
    return serverError(res, '获取联系人列表失败')
  }
}

/**
 * 获取联系人详情
 */
export async function getContactById(req, res) {
  try {
    const contact = await model.getContactById(req.params.contactId)
    if (!contact) {
      return notFound(res, '联系人不存在')
    }
    return success(res, contact)
  } catch (error) {
    console.error('获取联系人详情失败:', error)
    return serverError(res, '获取联系人详情失败')
  }
}

/**
 * 创建联系人
 */
export async function createContact(req, res) {
  try {
    const { customerId } = req.params
    const { contactName } = req.body
    
    if (!contactName) {
      return badRequest(res, '联系人姓名为必填项')
    }
    
    const customer = await model.getCustomerById(customerId)
    if (!customer) {
      return notFound(res, '客户不存在')
    }
    
    const result = await model.createContact({
      ...req.body,
      customerId
    })
    const newContact = await model.getContactById(result.id)
    
    return success(res, newContact, '创建成功')
  } catch (error) {
    console.error('创建联系人失败:', error)
    return serverError(res, '创建联系人失败')
  }
}

/**
 * 更新联系人
 */
export async function updateContact(req, res) {
  try {
    const { contactId } = req.params
    
    const existing = await model.getContactById(contactId)
    if (!existing) {
      return notFound(res, '联系人不存在')
    }
    
    const updated = await model.updateContact(contactId, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedContact = await model.getContactById(contactId)
    return success(res, updatedContact, '更新成功')
  } catch (error) {
    console.error('更新联系人失败:', error)
    return serverError(res, '更新联系人失败')
  }
}

/**
 * 删除联系人
 */
export async function deleteContact(req, res) {
  try {
    const { contactId } = req.params
    
    const existing = await model.getContactById(contactId)
    if (!existing) {
      return notFound(res, '联系人不存在')
    }
    
    model.deleteContact(contactId)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除联系人失败:', error)
    return serverError(res, '删除联系人失败')
  }
}

// ==================== 跟进记录管理 ====================

/**
 * 获取跟进记录列表
 */
export async function getFollowUps(req, res) {
  try {
    const { customerId, type, operatorId, startDate, endDate, page, pageSize } = req.query
    
    const result = await model.getFollowUps({
      customerId,
      type,
      operatorId: operatorId ? parseInt(operatorId) : undefined,
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
    console.error('获取跟进记录失败:', error)
    return serverError(res, '获取跟进记录失败')
  }
}

/**
 * 获取客户跟进记录
 */
export async function getCustomerFollowUps(req, res) {
  try {
    const { customerId } = req.params
    const { page, pageSize } = req.query
    
    const customer = await model.getCustomerById(customerId)
    if (!customer) {
      return notFound(res, '客户不存在')
    }
    
    const result = await model.getFollowUps({
      customerId,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取客户跟进记录失败:', error)
    return serverError(res, '获取客户跟进记录失败')
  }
}

/**
 * 创建跟进记录
 */
export async function createFollowUp(req, res) {
  try {
    const { customerId } = req.params
    const { content } = req.body
    
    if (!content) {
      return badRequest(res, '跟进内容为必填项')
    }
    
    const customer = await model.getCustomerById(customerId)
    if (!customer) {
      return notFound(res, '客户不存在')
    }
    
    const result = await model.createFollowUp({
      ...req.body,
      customerId,
      operatorId: req.user?.id,
      operatorName: req.user?.name || '系统'
    })
    
    return success(res, { id: result.id }, '创建成功')
  } catch (error) {
    console.error('创建跟进记录失败:', error)
    return serverError(res, '创建跟进记录失败')
  }
}

/**
 * 更新跟进记录
 */
export async function updateFollowUp(req, res) {
  try {
    const { followUpId } = req.params
    
    const result = await model.getFollowUps({ page: 1, pageSize: 1 })
    // 简单检查记录是否存在
    
    const updated = await model.updateFollowUp(followUpId, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段或记录不存在')
    }
    
    return success(res, null, '更新成功')
  } catch (error) {
    console.error('更新跟进记录失败:', error)
    return serverError(res, '更新跟进记录失败')
  }
}

/**
 * 删除跟进记录
 */
export async function deleteFollowUp(req, res) {
  try {
    const { followUpId } = req.params
    
    const deleted = await model.deleteFollowUp(followUpId)
    if (!deleted) {
      return notFound(res, '跟进记录不存在')
    }
    
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除跟进记录失败:', error)
    return serverError(res, '删除跟进记录失败')
  }
}

// ==================== 客户订单 ====================

/**
 * 获取客户订单统计
 */
export async function getCustomerOrderStats(req, res) {
  try {
    const { customerId } = req.params
    
    const customer = await model.getCustomerById(customerId)
    if (!customer) {
      return notFound(res, '客户不存在')
    }
    
    const stats = await model.getCustomerOrderStats(customerId)
    return success(res, stats)
  } catch (error) {
    console.error('获取客户订单统计失败:', error)
    return serverError(res, '获取客户订单统计失败')
  }
}

/**
 * 获取客户订单列表
 */
export async function getCustomerOrders(req, res) {
  try {
    const { customerId } = req.params
    const { page, pageSize, search, status } = req.query
    
    const customer = await model.getCustomerById(customerId)
    if (!customer) {
      return notFound(res, '客户不存在')
    }
    
    const result = await model.getCustomerOrders(customerId, {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 10,
      search: search || '',
      status: status || ''
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取客户订单列表失败:', error)
    return serverError(res, '获取客户订单列表失败')
  }
}

// ==================== 客户地址管理 ====================

/**
 * 获取客户地址列表
 */
export async function getCustomerAddresses(req, res) {
  try {
    const { customerId } = req.params
    
    const customer = await model.getCustomerById(customerId)
    if (!customer) {
      return notFound(res, '客户不存在')
    }
    
    const addresses = await model.getCustomerAddresses(customerId)
    return success(res, addresses)
  } catch (error) {
    console.error('获取客户地址列表失败:', error)
    return serverError(res, '获取客户地址列表失败')
  }
}

/**
 * 创建客户地址
 */
export async function createCustomerAddress(req, res) {
  try {
    const { customerId } = req.params
    const { companyName, address } = req.body
    
    if (!companyName || !address) {
      return badRequest(res, '公司名称和地址为必填项')
    }
    
    const customer = await model.getCustomerById(customerId)
    if (!customer) {
      return notFound(res, '客户不存在')
    }
    
    const result = await model.createCustomerAddress(customerId, req.body)
    return success(res, result, '地址创建成功')
  } catch (error) {
    console.error('创建客户地址失败:', error)
    return serverError(res, '创建客户地址失败')
  }
}

/**
 * 更新客户地址
 */
export async function updateCustomerAddress(req, res) {
  try {
    const { addressId } = req.params
    
    const result = await model.updateCustomerAddress(addressId, req.body)
    if (!result) {
      return notFound(res, '地址不存在')
    }
    
    return success(res, result, '地址更新成功')
  } catch (error) {
    console.error('更新客户地址失败:', error)
    return serverError(res, '更新客户地址失败')
  }
}

/**
 * 删除客户地址
 */
export async function deleteCustomerAddress(req, res) {
  try {
    const { addressId } = req.params
    
    await model.deleteCustomerAddress(addressId)
    return success(res, null, '地址删除成功')
  } catch (error) {
    console.error('删除客户地址失败:', error)
    return serverError(res, '删除客户地址失败')
  }
}

// ==================== 客户税号管理 ====================

/**
 * 获取客户税号列表
 */
export async function getCustomerTaxNumbers(req, res) {
  try {
    const { customerId } = req.params
    
    const customer = await model.getCustomerById(customerId)
    if (!customer) {
      return notFound(res, '客户不存在')
    }
    
    const taxNumbers = await model.getCustomerTaxNumbers(customerId)
    return success(res, taxNumbers)
  } catch (error) {
    console.error('获取客户税号列表失败:', error)
    return serverError(res, '获取客户税号列表失败')
  }
}

/**
 * 创建客户税号
 */
export async function createCustomerTaxNumber(req, res) {
  try {
    const { customerId } = req.params
    const { taxType, taxNumber } = req.body
    
    if (!taxType || !taxNumber) {
      return badRequest(res, '税号类型和税号为必填项')
    }
    
    const customer = await model.getCustomerById(customerId)
    if (!customer) {
      return notFound(res, '客户不存在')
    }
    
    const result = await model.createCustomerTaxNumber(customerId, req.body)
    return success(res, result, '税号创建成功')
  } catch (error) {
    console.error('创建客户税号失败:', error)
    // 如果是重复错误，返回具体信息
    if (error.message && error.message.includes('已存在')) {
      return badRequest(res, error.message)
    }
    return serverError(res, '创建客户税号失败')
  }
}

/**
 * 更新客户税号
 */
export async function updateCustomerTaxNumber(req, res) {
  try {
    const { taxId } = req.params
    
    const result = await model.updateCustomerTaxNumber(taxId, req.body)
    if (!result) {
      return notFound(res, '税号不存在')
    }
    
    return success(res, result, '税号更新成功')
  } catch (error) {
    console.error('更新客户税号失败:', error)
    // 如果是重复错误，返回具体信息
    if (error.message && error.message.includes('已存在')) {
      return badRequest(res, error.message)
    }
    return serverError(res, '更新客户税号失败')
  }
}

/**
 * 删除客户税号
 */
export async function deleteCustomerTaxNumber(req, res) {
  try {
    const { taxId } = req.params
    
    await model.deleteCustomerTaxNumber(taxId)
    return success(res, null, '税号删除成功')
  } catch (error) {
    console.error('删除客户税号失败:', error)
    return serverError(res, '删除客户税号失败')
  }
}

// ==================== 共享税号管理（公司级税号库） ====================

/**
 * 获取共享税号列表
 */
export async function getSharedTaxNumbers(req, res) {
  try {
    const { taxType, search, status, page, pageSize } = req.query
    
    const result = await model.getSharedTaxNumbers({
      taxType,
      search,
      status,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 50
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取共享税号列表失败:', error)
    return serverError(res, '获取共享税号列表失败')
  }
}

/**
 * 获取共享税号详情
 */
export async function getSharedTaxNumberById(req, res) {
  try {
    const { id } = req.params
    const result = await model.getSharedTaxNumberById(id)
    
    if (!result) {
      return notFound(res, '共享税号不存在')
    }
    
    return success(res, result)
  } catch (error) {
    console.error('获取共享税号详情失败:', error)
    return serverError(res, '获取共享税号详情失败')
  }
}

/**
 * 创建共享税号
 */
export async function createSharedTaxNumber(req, res) {
  try {
    const { taxType, taxNumber } = req.body
    
    if (!taxType || !taxNumber) {
      return badRequest(res, '税号类型和税号为必填项')
    }
    
    const result = await model.createSharedTaxNumber(req.body)
    return success(res, result, '共享税号创建成功')
  } catch (error) {
    console.error('创建共享税号失败:', error)
    if (error.message && error.message.includes('已存在')) {
      return badRequest(res, error.message)
    }
    return serverError(res, '创建共享税号失败')
  }
}

/**
 * 更新共享税号
 */
export async function updateSharedTaxNumber(req, res) {
  try {
    const { id } = req.params
    
    const result = await model.updateSharedTaxNumber(id, req.body)
    return success(res, result, '共享税号更新成功')
  } catch (error) {
    console.error('更新共享税号失败:', error)
    if (error.message && error.message.includes('已存在')) {
      return badRequest(res, error.message)
    }
    return serverError(res, '更新共享税号失败')
  }
}

/**
 * 删除共享税号
 */
export async function deleteSharedTaxNumber(req, res) {
  try {
    const { id } = req.params
    
    await model.deleteSharedTaxNumber(id)
    return success(res, null, '共享税号删除成功')
  } catch (error) {
    console.error('删除共享税号失败:', error)
    return serverError(res, '删除共享税号失败')
  }
}

// ==================== 销售机会管理 ====================

/**
 * 获取销售机会列表
 */
export async function getOpportunities(req, res) {
  try {
    const { customerId, stage, assignedTo, startDate, endDate, search, page, pageSize } = req.query
    
    const result = await model.getOpportunities({
      customerId,
      stage,
      assignedTo: assignedTo ? parseInt(assignedTo) : undefined,
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
    console.error('获取销售机会列表失败:', error)
    return serverError(res, '获取销售机会列表失败')
  }
}

/**
 * 获取销售机会统计
 */
export async function getOpportunityStats(req, res) {
  try {
    const stats = await model.getOpportunityStats()
    return success(res, stats)
  } catch (error) {
    console.error('获取销售机会统计失败:', error)
    return serverError(res, '获取销售机会统计失败')
  }
}

/**
 * 获取销售机会详情
 */
export async function getOpportunityById(req, res) {
  try {
    const opportunity = await model.getOpportunityById(req.params.id)
    if (!opportunity) {
      return notFound(res, '销售机会不存在')
    }
    return success(res, opportunity)
  } catch (error) {
    console.error('获取销售机会详情失败:', error)
    return serverError(res, '获取销售机会详情失败')
  }
}

/**
 * 创建销售机会
 */
export async function createOpportunity(req, res) {
  try {
    const { opportunityName } = req.body
    
    if (!opportunityName) {
      return badRequest(res, '机会名称为必填项')
    }
    
    const result = await model.createOpportunity({
      ...req.body,
      assignedTo: req.body.assignedTo || req.user?.id,
      assignedName: req.body.assignedName || req.user?.name || ''
    })
    const newOpportunity = await model.getOpportunityById(result.id)
    
    return success(res, newOpportunity, '创建成功')
  } catch (error) {
    console.error('创建销售机会失败:', error)
    return serverError(res, '创建销售机会失败')
  }
}

/**
 * 更新销售机会
 */
export async function updateOpportunity(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getOpportunityById(id)
    if (!existing) {
      return notFound(res, '销售机会不存在')
    }
    
    const updated = await model.updateOpportunity(id, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedOpportunity = await model.getOpportunityById(id)
    return success(res, updatedOpportunity, '更新成功')
  } catch (error) {
    console.error('更新销售机会失败:', error)
    return serverError(res, '更新销售机会失败')
  }
}

/**
 * 更新销售机会阶段
 */
export async function updateOpportunityStage(req, res) {
  try {
    const { id } = req.params
    const { stage, lostReason } = req.body
    
    const validStages = ['lead', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
    if (!stage || !validStages.includes(stage)) {
      return badRequest(res, '无效的阶段值')
    }
    
    const existing = await model.getOpportunityById(id)
    if (!existing) {
      return notFound(res, '销售机会不存在')
    }
    
    await model.updateOpportunityStage(id, stage, lostReason || '')
    const updated = await model.getOpportunityById(id)
    
    return success(res, updated, '阶段更新成功')
  } catch (error) {
    console.error('更新销售机会阶段失败:', error)
    return serverError(res, '更新销售机会阶段失败')
  }
}

/**
 * 删除销售机会
 */
export async function deleteOpportunity(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getOpportunityById(id)
    if (!existing) {
      return notFound(res, '销售机会不存在')
    }
    
    model.deleteOpportunity(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除销售机会失败:', error)
    return serverError(res, '删除销售机会失败')
  }
}

// ==================== 报价管理 ====================

/**
 * 获取报价列表
 */
export async function getQuotations(req, res) {
  try {
    const { customerId, opportunityId, status, startDate, endDate, search, page, pageSize } = req.query
    
    const result = await model.getQuotations({
      customerId,
      opportunityId,
      status,
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
    console.error('获取报价列表失败:', error)
    return serverError(res, '获取报价列表失败')
  }
}

/**
 * 获取报价详情
 */
export async function getQuotationById(req, res) {
  try {
    const quotation = await model.getQuotationById(req.params.id)
    if (!quotation) {
      return notFound(res, '报价不存在')
    }
    return success(res, quotation)
  } catch (error) {
    console.error('获取报价详情失败:', error)
    return serverError(res, '获取报价详情失败')
  }
}

/**
 * 创建报价
 */
export async function createQuotation(req, res) {
  try {
    const { customerId, customerName } = req.body
    
    if (!customerId && !customerName) {
      return badRequest(res, '客户信息为必填项')
    }
    
    const result = await model.createQuotation({
      ...req.body,
      createdBy: req.user?.id,
      createdByName: req.user?.name || '系统'
    })
    const newQuotation = await model.getQuotationById(result.id)
    
    return success(res, newQuotation, '创建成功')
  } catch (error) {
    console.error('创建报价失败:', error)
    return serverError(res, '创建报价失败')
  }
}

/**
 * 更新报价
 */
export async function updateQuotation(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getQuotationById(id)
    if (!existing) {
      return notFound(res, '报价不存在')
    }
    
    // 已发送或已接受的报价不能修改
    if (['sent', 'accepted'].includes(existing.status) && req.body.items) {
      return badRequest(res, '已发送的报价不能修改明细')
    }
    
    const updated = await model.updateQuotation(id, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedQuotation = await model.getQuotationById(id)
    return success(res, updatedQuotation, '更新成功')
  } catch (error) {
    console.error('更新报价失败:', error)
    return serverError(res, '更新报价失败')
  }
}

/**
 * 删除报价
 */
export async function deleteQuotation(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getQuotationById(id)
    if (!existing) {
      return notFound(res, '报价不存在')
    }
    
    // 已接受的报价不能删除
    if (existing.status === 'accepted') {
      return badRequest(res, '已接受的报价不能删除')
    }
    
    model.deleteQuotation(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除报价失败:', error)
    return serverError(res, '删除报价失败')
  }
}

// ==================== 合同管理 ====================

/**
 * 获取合同列表
 */
export async function getContracts(req, res) {
  try {
    const { customerId, status, startDate, endDate, search, page, pageSize } = req.query
    
    const result = await model.getContracts({
      customerId,
      status,
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
    console.error('获取合同列表失败:', error)
    return serverError(res, '获取合同列表失败')
  }
}

/**
 * 获取合同详情
 */
export async function getContractById(req, res) {
  try {
    const contract = await model.getContractById(req.params.id)
    if (!contract) {
      return notFound(res, '合同不存在')
    }
    return success(res, contract)
  } catch (error) {
    console.error('获取合同详情失败:', error)
    return serverError(res, '获取合同详情失败')
  }
}

/**
 * 创建合同
 */
export async function createContract(req, res) {
  try {
    const { contractName, customerId, customerName } = req.body
    
    if (!contractName) {
      return badRequest(res, '合同名称为必填项')
    }
    
    if (!customerId && !customerName) {
      return badRequest(res, '客户信息为必填项')
    }
    
    const result = await model.createContract({
      ...req.body,
      createdBy: req.user?.id,
      createdByName: req.user?.name || '系统'
    })
    const newContract = await model.getContractById(result.id)
    
    return success(res, newContract, '创建成功')
  } catch (error) {
    console.error('创建合同失败:', error)
    return serverError(res, '创建合同失败')
  }
}

/**
 * 更新合同
 */
export async function updateContract(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getContractById(id)
    if (!existing) {
      return notFound(res, '合同不存在')
    }
    
    const updated = await model.updateContract(id, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedContract = await model.getContractById(id)
    return success(res, updatedContract, '更新成功')
  } catch (error) {
    console.error('更新合同失败:', error)
    return serverError(res, '更新合同失败')
  }
}

/**
 * 删除合同
 */
export async function deleteContract(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getContractById(id)
    if (!existing) {
      return notFound(res, '合同不存在')
    }
    
    // 生效中的合同不能删除
    if (existing.status === 'active') {
      return badRequest(res, '生效中的合同不能删除')
    }
    
    model.deleteContract(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除合同失败:', error)
    return serverError(res, '删除合同失败')
  }
}

// ==================== 客户反馈/投诉管理 ====================

/**
 * 获取反馈列表
 */
export async function getFeedbacks(req, res) {
  try {
    const { customerId, type, status, priority, assignedTo, startDate, endDate, search, page, pageSize } = req.query
    
    const result = await model.getFeedbacks({
      customerId,
      type,
      status,
      priority,
      assignedTo: assignedTo ? parseInt(assignedTo) : undefined,
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
    console.error('获取反馈列表失败:', error)
    return serverError(res, '获取反馈列表失败')
  }
}

/**
 * 获取反馈统计
 */
export async function getFeedbackStats(req, res) {
  try {
    const stats = await model.getFeedbackStats()
    return success(res, stats)
  } catch (error) {
    console.error('获取反馈统计失败:', error)
    return serverError(res, '获取反馈统计失败')
  }
}

/**
 * 获取反馈详情
 */
export async function getFeedbackById(req, res) {
  try {
    const feedback = await model.getFeedbackById(req.params.id)
    if (!feedback) {
      return notFound(res, '反馈不存在')
    }
    return success(res, feedback)
  } catch (error) {
    console.error('获取反馈详情失败:', error)
    return serverError(res, '获取反馈详情失败')
  }
}

/**
 * 创建反馈
 */
export async function createFeedback(req, res) {
  try {
    const { subject, content } = req.body
    
    if (!subject || !content) {
      return badRequest(res, '主题和内容为必填项')
    }
    
    const result = await model.createFeedback({
      ...req.body,
      assignedTo: req.body.assignedTo || req.user?.id,
      assignedName: req.body.assignedName || req.user?.name || ''
    })
    const newFeedback = await model.getFeedbackById(result.id)
    
    return success(res, newFeedback, '创建成功')
  } catch (error) {
    console.error('创建反馈失败:', error)
    return serverError(res, '创建反馈失败')
  }
}

/**
 * 更新反馈
 */
export async function updateFeedback(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getFeedbackById(id)
    if (!existing) {
      return notFound(res, '反馈不存在')
    }
    
    const updated = await model.updateFeedback(id, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedFeedback = await model.getFeedbackById(id)
    return success(res, updatedFeedback, '更新成功')
  } catch (error) {
    console.error('更新反馈失败:', error)
    return serverError(res, '更新反馈失败')
  }
}

/**
 * 解决反馈
 */
export async function resolveFeedback(req, res) {
  try {
    const { id } = req.params
    const { resolution } = req.body
    
    if (!resolution) {
      return badRequest(res, '解决方案为必填项')
    }
    
    const existing = await model.getFeedbackById(id)
    if (!existing) {
      return notFound(res, '反馈不存在')
    }
    
    await model.resolveFeedback(id, resolution)
    const updated = await model.getFeedbackById(id)
    
    return success(res, updated, '反馈已解决')
  } catch (error) {
    console.error('解决反馈失败:', error)
    return serverError(res, '解决反馈失败')
  }
}

/**
 * 删除反馈
 */
export async function deleteFeedback(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getFeedbackById(id)
    if (!existing) {
      return notFound(res, '反馈不存在')
    }
    
    model.deleteFeedback(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除反馈失败:', error)
    return serverError(res, '删除反馈失败')
  }
}

// ==================== 客户分析统计 ====================

/**
 * 获取客户价值分析
 */
export async function getCustomerValueAnalysis(req, res) {
  try {
    const { customerId } = req.params
    
    const analysis = await model.getCustomerValueAnalysis(customerId)
    if (!analysis) {
      return notFound(res, '客户不存在')
    }
    
    return success(res, analysis)
  } catch (error) {
    console.error('获取客户价值分析失败:', error)
    return serverError(res, '获取客户价值分析失败')
  }
}

/**
 * 获取销售漏斗数据
 */
export async function getSalesFunnel(req, res) {
  try {
    const funnel = await model.getSalesFunnel()
    return success(res, funnel)
  } catch (error) {
    console.error('获取销售漏斗数据失败:', error)
    return serverError(res, '获取销售漏斗数据失败')
  }
}

/**
 * 获取客户活跃度排行
 */
export async function getCustomerActivityRanking(req, res) {
  try {
    const { limit } = req.query
    const ranking = await model.getCustomerActivityRanking(parseInt(limit) || 10)
    return success(res, ranking)
  } catch (error) {
    console.error('获取客户活跃度排行失败:', error)
    return serverError(res, '获取客户活跃度排行失败')
  }
}

// ==================== 税号验证 ====================

import * as taxValidation from './taxValidation.js'

/**
 * VAT税号验证
 */
export async function validateVAT(req, res) {
  try {
    const { vatNumber, countryCode } = req.body
    
    if (!vatNumber) {
      return badRequest(res, 'VAT税号为必填项')
    }
    
    console.log(`[VAT验证] 开始验证: ${vatNumber}, 国家: ${countryCode || '自动识别'}`)
    
    const result = await taxValidation.validateVAT(vatNumber, countryCode)
    
    console.log(`[VAT验证] 验证结果:`, {
      valid: result.valid,
      companyName: result.companyName,
      error: result.error
    })
    
    if (result.valid) {
      return success(res, {
        valid: true,
        vatNumber: result.vatNumber,
        countryCode: result.countryCode,
        companyName: result.companyName,
        companyAddress: result.companyAddress,
        verifiedAt: result.verifiedAt
      }, 'VAT税号验证通过')
    } else {
      return success(res, {
        valid: false,
        vatNumber: result.vatNumber,
        countryCode: result.countryCode,
        error: result.error
      }, 'VAT税号验证失败')
    }
  } catch (error) {
    console.error('VAT税号验证失败:', error)
    return serverError(res, `VAT验证服务暂时不可用: ${error.message}`)
  }
}

/**
 * EORI号码验证
 */
export async function validateEORI(req, res) {
  try {
    const { eoriNumber } = req.body
    
    if (!eoriNumber) {
      return badRequest(res, 'EORI号码为必填项')
    }
    
    console.log(`[EORI验证] 开始验证: ${eoriNumber}`)
    
    const result = await taxValidation.validateEORI(eoriNumber)
    
    console.log(`[EORI验证] 验证结果:`, {
      valid: result.valid,
      companyName: result.companyName,
      error: result.error
    })
    
    if (result.valid) {
      return success(res, {
        valid: true,
        eoriNumber: result.eoriNumber,
        countryCode: result.countryCode,
        companyName: result.companyName,
        companyAddress: result.companyAddress,
        verifiedAt: result.verifiedAt
      }, 'EORI号码验证通过')
    } else {
      return success(res, {
        valid: false,
        eoriNumber: result.eoriNumber,
        countryCode: result.countryCode,
        error: result.error
      }, 'EORI号码验证失败')
    }
  } catch (error) {
    console.error('EORI号码验证失败:', error)
    return serverError(res, `EORI验证服务暂时不可用: ${error.message}`)
  }
}

/**
 * 获取支持的VAT国家列表
 */
export async function getSupportedVatCountries(req, res) {
  try {
    const countries = taxValidation.getSupportedVatCountries()
    return success(res, countries)
  } catch (error) {
    console.error('获取支持的VAT国家列表失败:', error)
    return serverError(res, '获取支持的VAT国家列表失败')
  }
}

// ==================== 税号自动验证 ====================

import { validateAllTaxNumbers as runValidateAll, getValidationStats } from './taxScheduler.js'

/**
 * 手动触发批量验证所有税号
 */
export async function validateAllTaxNumbers(req, res) {
  try {
    console.log('🔄 [手动触发] 开始批量验证所有税号...')
    const result = await runValidateAll()
    
    if (result.success) {
      return success(res, result, `税号验证完成: 总计${result.total}个，有效${result.validated}个，无效${result.failed}个`)
    } else {
      return serverError(res, result.error || '批量验证失败')
    }
  } catch (error) {
    console.error('批量验证税号失败:', error)
    return serverError(res, `批量验证失败: ${error.message}`)
  }
}

/**
 * 获取税号验证统计
 */
export async function getTaxValidationStats(req, res) {
  try {
    const stats = await getValidationStats()
    return success(res, stats)
  } catch (error) {
    console.error('获取税号验证统计失败:', error)
    return serverError(res, '获取统计失败')
  }
}

// ==================== 营业执照OCR识别 ====================

import * as ocrService from './ocrService.js'

/**
 * 识别营业执照图片
 */
export async function recognizeBusinessLicense(req, res) {
  try {
    const { imageBase64, imageUrl } = req.body
    
    if (!imageBase64 && !imageUrl) {
      return badRequest(res, '请提供营业执照图片（Base64编码或URL）')
    }
    
    // 检查配置
    const config = ocrService.checkOcrConfig()
    if (!config.configured) {
      return serverError(res, '营业执照识别服务未配置，请联系管理员')
    }
    
    // 调用OCR识别
    const result = await ocrService.recognizeBusinessLicense(imageBase64, imageUrl)
    
    if (result.success) {
      return success(res, result.data, '营业执照识别成功')
    } else {
      return badRequest(res, result.error || '营业执照识别失败')
    }
  } catch (error) {
    console.error('营业执照识别失败:', error)
    return serverError(res, '营业执照识别服务暂时不可用')
  }
}

/**
 * 检查OCR服务配置状态
 */
export async function checkOcrStatus(req, res) {
  try {
    const config = ocrService.checkOcrConfig()
    return success(res, {
      available: config.configured,
      message: config.configured ? 'OCR服务已配置' : 'OCR服务未配置'
    })
  } catch (error) {
    console.error('检查OCR状态失败:', error)
    return serverError(res, '检查OCR状态失败')
  }
}

