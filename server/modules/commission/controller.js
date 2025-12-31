/**
 * 业务员提成模块 - 控制器
 */

import * as model from './model.js'

// ==================== 提成规则管理 ====================

/**
 * 获取提成规则列表
 */
export async function getRules(req, res) {
  try {
    const { ruleType, customerLevel, isActive, page, pageSize } = req.query
    
    const result = await model.getRules({
      ruleType,
      customerLevel,
      isActive: isActive !== undefined ? isActive === 'true' || isActive === '1' : undefined,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 50
    })
    
    res.json({ errCode: 200, msg: 'success', data: result })
  } catch (error) {
    console.error('获取提成规则失败:', error)
    res.json({ errCode: 500, msg: error.message || '获取提成规则失败' })
  }
}

/**
 * 获取规则详情
 */
export async function getRuleById(req, res) {
  try {
    const { id } = req.params
    const rule = await model.getRuleById(parseInt(id))
    
    if (!rule) {
      return res.json({ errCode: 404, msg: '规则不存在' })
    }
    
    res.json({ errCode: 200, msg: 'success', data: rule })
  } catch (error) {
    console.error('获取规则详情失败:', error)
    res.json({ errCode: 500, msg: error.message || '获取规则详情失败' })
  }
}

/**
 * 创建提成规则
 */
export async function createRule(req, res) {
  try {
    const { ruleName, ruleType } = req.body
    
    if (!ruleName) {
      return res.json({ errCode: 400, msg: '请输入规则名称' })
    }
    
    if (!ruleType) {
      return res.json({ errCode: 400, msg: '请选择规则类型' })
    }
    
    const data = {
      ...req.body,
      createdBy: req.user?.id
    }
    
    const result = await model.createRule(data)
    res.json({ errCode: 200, msg: '创建成功', data: result })
  } catch (error) {
    console.error('创建提成规则失败:', error)
    res.json({ errCode: 500, msg: error.message || '创建提成规则失败' })
  }
}

/**
 * 更新提成规则
 */
export async function updateRule(req, res) {
  try {
    const { id } = req.params
    const success = await model.updateRule(parseInt(id), req.body)
    
    if (!success) {
      return res.json({ errCode: 400, msg: '更新失败或规则不存在' })
    }
    
    res.json({ errCode: 200, msg: '更新成功' })
  } catch (error) {
    console.error('更新提成规则失败:', error)
    res.json({ errCode: 500, msg: error.message || '更新提成规则失败' })
  }
}

/**
 * 删除提成规则
 */
export async function deleteRule(req, res) {
  try {
    const { id } = req.params
    const success = await model.deleteRule(parseInt(id))
    
    if (!success) {
      return res.json({ errCode: 400, msg: '删除失败或规则不存在' })
    }
    
    res.json({ errCode: 200, msg: '删除成功' })
  } catch (error) {
    console.error('删除提成规则失败:', error)
    res.json({ errCode: 500, msg: error.message || '删除提成规则失败' })
  }
}

// ==================== 提成记录管理 ====================

/**
 * 获取提成记录列表
 */
export async function getRecords(req, res) {
  try {
    const { 
      salespersonId, customerId, settlementMonth, status,
      sourceType, startDate, endDate, search, page, pageSize 
    } = req.query
    
    const result = await model.getRecords({
      salespersonId: salespersonId ? parseInt(salespersonId) : undefined,
      customerId,
      settlementMonth,
      status,
      sourceType,
      startDate,
      endDate,
      search,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20
    })
    
    res.json({ errCode: 200, msg: 'success', data: result })
  } catch (error) {
    console.error('获取提成记录失败:', error)
    res.json({ errCode: 500, msg: error.message || '获取提成记录失败' })
  }
}

/**
 * 获取记录详情
 */
export async function getRecordById(req, res) {
  try {
    const { id } = req.params
    const record = await model.getRecordById(id)
    
    if (!record) {
      return res.json({ errCode: 404, msg: '记录不存在' })
    }
    
    res.json({ errCode: 200, msg: 'success', data: record })
  } catch (error) {
    console.error('获取记录详情失败:', error)
    res.json({ errCode: 500, msg: error.message || '获取记录详情失败' })
  }
}

/**
 * 手动计算提成
 */
export async function calculateCommission(req, res) {
  try {
    const {
      salespersonId, salespersonName, customerId, customerName, customerLevel,
      sourceType, sourceId, sourceNo, amount, commissionBase
    } = req.body
    
    if (!salespersonId) {
      return res.json({ errCode: 400, msg: '请选择业务员' })
    }
    
    if (!sourceType) {
      return res.json({ errCode: 400, msg: '请选择来源类型' })
    }
    
    if (!amount || amount <= 0) {
      return res.json({ errCode: 400, msg: '请输入有效的金额' })
    }
    
    const result = await model.calculateCommission({
      salespersonId: parseInt(salespersonId),
      salespersonName,
      customerId,
      customerName,
      customerLevel: customerLevel || 'normal',
      sourceType,
      sourceId,
      sourceNo,
      amount: parseFloat(amount),
      commissionBase: commissionBase || 'contract_amount'
    })
    
    res.json({ errCode: 200, msg: '计算成功', data: result })
  } catch (error) {
    console.error('计算提成失败:', error)
    res.json({ errCode: 500, msg: error.message || '计算提成失败' })
  }
}

/**
 * 取消提成记录
 */
export async function cancelRecord(req, res) {
  try {
    const { id } = req.params
    const { reason } = req.body
    
    const success = await model.cancelRecord(id, reason)
    
    if (!success) {
      return res.json({ errCode: 400, msg: '取消失败，记录不存在或已结算' })
    }
    
    res.json({ errCode: 200, msg: '取消成功' })
  } catch (error) {
    console.error('取消提成记录失败:', error)
    res.json({ errCode: 500, msg: error.message || '取消提成记录失败' })
  }
}

// ==================== 结算管理 ====================

/**
 * 获取结算单列表
 */
export async function getSettlements(req, res) {
  try {
    const { salespersonId, settlementMonth, status, page, pageSize } = req.query
    
    const result = await model.getSettlements({
      salespersonId: salespersonId ? parseInt(salespersonId) : undefined,
      settlementMonth,
      status,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20
    })
    
    res.json({ errCode: 200, msg: 'success', data: result })
  } catch (error) {
    console.error('获取结算单失败:', error)
    res.json({ errCode: 500, msg: error.message || '获取结算单失败' })
  }
}

/**
 * 获取结算单详情
 */
export async function getSettlementById(req, res) {
  try {
    const { id } = req.params
    const settlement = await model.getSettlementById(id)
    
    if (!settlement) {
      return res.json({ errCode: 404, msg: '结算单不存在' })
    }
    
    // 获取关联的提成记录
    const records = await model.getRecords({
      settlementId: id,
      pageSize: 1000
    })
    
    res.json({ 
      errCode: 200, 
      msg: 'success', 
      data: { ...settlement, records: records.list }
    })
  } catch (error) {
    console.error('获取结算单详情失败:', error)
    res.json({ errCode: 500, msg: error.message || '获取结算单详情失败' })
  }
}

/**
 * 获取结算单汇总统计
 */
export async function getSettlementsSummary(req, res) {
  try {
    const result = await model.getSettlementsSummary()
    res.json({ errCode: 200, msg: 'success', data: result })
  } catch (error) {
    console.error('获取结算单统计失败:', error)
    res.json({ errCode: 500, msg: error.message || '获取结算单统计失败' })
  }
}

/**
 * 导出结算单PDF
 */
export async function exportSettlement(req, res) {
  try {
    const { id } = req.params
    // 暂时返回一个简单的响应，实际需要生成PDF
    const settlement = await model.getSettlementById(id)
    if (!settlement) {
      return res.json({ errCode: 404, msg: '结算单不存在' })
    }
    
    // TODO: 实现PDF生成逻辑
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=settlement_${settlement.settlementNo}.pdf`)
    res.send(Buffer.from('PDF内容待实现', 'utf-8'))
  } catch (error) {
    console.error('导出结算单失败:', error)
    res.json({ errCode: 500, msg: error.message || '导出结算单失败' })
  }
}

/**
 * 生成月度结算单（单个业务员）
 */
export async function generateSettlement(req, res) {
  try {
    const { salespersonId, salespersonName, month } = req.body
    
    if (!salespersonId) {
      return res.json({ errCode: 400, msg: '请选择业务员' })
    }
    
    if (!month) {
      return res.json({ errCode: 400, msg: '请选择结算月份' })
    }
    
    const result = await model.generateSettlement(
      parseInt(salespersonId),
      salespersonName,
      month
    )
    
    res.json({ errCode: 200, msg: '生成成功', data: result })
  } catch (error) {
    console.error('生成结算单失败:', error)
    res.json({ errCode: 500, msg: error.message || '生成结算单失败' })
  }
}

/**
 * 自动批量生成结算单（所有业务员）
 */
export async function autoGenerateSettlements(req, res) {
  try {
    const { month } = req.body
    
    if (!month) {
      return res.json({ errCode: 400, msg: '请选择结算月份' })
    }
    
    const result = await model.autoGenerateSettlements(month)
    res.json({ errCode: 200, msg: '生成成功', data: result })
  } catch (error) {
    console.error('自动生成结算单失败:', error)
    res.json({ errCode: 500, msg: error.message || '自动生成结算单失败' })
  }
}

/**
 * 批量提交审批
 */
export async function batchSubmitSettlements(req, res) {
  try {
    const { ids } = req.body
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.json({ errCode: 400, msg: '请选择要提交的结算单' })
    }
    
    const result = await model.batchSubmitSettlements(ids)
    res.json({ errCode: 200, msg: '批量提交成功', data: result })
  } catch (error) {
    console.error('批量提交结算单失败:', error)
    res.json({ errCode: 500, msg: error.message || '批量提交结算单失败' })
  }
}

/**
 * 提交结算单审批
 */
export async function submitSettlement(req, res) {
  try {
    const { id } = req.params
    const success = await model.submitSettlement(id)
    
    if (!success) {
      return res.json({ errCode: 400, msg: '提交失败，结算单不存在或状态不正确' })
    }
    
    res.json({ errCode: 200, msg: '提交成功' })
  } catch (error) {
    console.error('提交结算单失败:', error)
    res.json({ errCode: 500, msg: error.message || '提交结算单失败' })
  }
}

/**
 * 审批通过结算单
 */
export async function approveSettlement(req, res) {
  try {
    const { id } = req.params
    const { comment } = req.body
    
    const reviewerId = req.user?.id || 0
    const reviewerName = req.user?.name || '系统'
    
    const success = await model.approveSettlement(id, reviewerId, reviewerName, comment)
    
    if (!success) {
      return res.json({ errCode: 400, msg: '审批失败，结算单不存在或状态不正确' })
    }
    
    res.json({ errCode: 200, msg: '审批通过' })
  } catch (error) {
    console.error('审批结算单失败:', error)
    res.json({ errCode: 500, msg: error.message || '审批结算单失败' })
  }
}

/**
 * 驳回结算单
 */
export async function rejectSettlement(req, res) {
  try {
    const { id } = req.params
    const { comment } = req.body
    
    if (!comment) {
      return res.json({ errCode: 400, msg: '请填写驳回原因' })
    }
    
    const reviewerId = req.user?.id || 0
    const reviewerName = req.user?.name || '系统'
    
    const success = await model.rejectSettlement(id, reviewerId, reviewerName, comment)
    
    if (!success) {
      return res.json({ errCode: 400, msg: '驳回失败，结算单不存在或状态不正确' })
    }
    
    res.json({ errCode: 200, msg: '已驳回' })
  } catch (error) {
    console.error('驳回结算单失败:', error)
    res.json({ errCode: 500, msg: error.message || '驳回结算单失败' })
  }
}

/**
 * 标记结算单已发放
 */
export async function markSettlementPaid(req, res) {
  try {
    const { id } = req.params
    const success = await model.markSettlementPaid(id)
    
    if (!success) {
      return res.json({ errCode: 400, msg: '操作失败，结算单不存在或未审批' })
    }
    
    res.json({ errCode: 200, msg: '已标记为已发放' })
  } catch (error) {
    console.error('标记发放失败:', error)
    res.json({ errCode: 500, msg: error.message || '标记发放失败' })
  }
}

// ==================== 统计分析 ====================

/**
 * 获取提成统计
 */
export async function getStats(req, res) {
  try {
    const { salespersonId, startMonth, endMonth } = req.query
    
    const result = await model.getCommissionStats({
      salespersonId: salespersonId ? parseInt(salespersonId) : undefined,
      startMonth,
      endMonth
    })
    
    res.json({ errCode: 200, msg: 'success', data: result })
  } catch (error) {
    console.error('获取提成统计失败:', error)
    res.json({ errCode: 500, msg: error.message || '获取提成统计失败' })
  }
}

/**
 * 获取业务员排行
 */
export async function getSalespersonRanking(req, res) {
  try {
    const { month, limit } = req.query
    
    // 默认使用当月
    const targetMonth = month || new Date().toISOString().slice(0, 7)
    
    const result = await model.getSalespersonRanking(
      targetMonth,
      limit ? parseInt(limit) : 10
    )
    
    res.json({ errCode: 200, msg: 'success', data: result })
  } catch (error) {
    console.error('获取业务员排行失败:', error)
    res.json({ errCode: 500, msg: error.message || '获取业务员排行失败' })
  }
}

// ==================== 惩罚规则管理 ====================

/**
 * 获取惩罚规则列表
 */
export async function getPenaltyRules(req, res) {
  try {
    const { penaltyType, isActive } = req.query
    
    const result = await model.getPenaltyRules({
      penaltyType,
      isActive: isActive !== undefined ? isActive === 'true' || isActive === '1' : undefined
    })
    
    res.json({ errCode: 200, msg: 'success', data: result })
  } catch (error) {
    console.error('获取惩罚规则失败:', error)
    res.json({ errCode: 500, msg: error.message || '获取惩罚规则失败' })
  }
}

/**
 * 获取惩罚规则详情
 */
export async function getPenaltyRuleById(req, res) {
  try {
    const { id } = req.params
    const rule = await model.getPenaltyRuleById(parseInt(id))
    
    if (!rule) {
      return res.json({ errCode: 404, msg: '惩罚规则不存在' })
    }
    
    res.json({ errCode: 200, msg: 'success', data: rule })
  } catch (error) {
    console.error('获取惩罚规则详情失败:', error)
    res.json({ errCode: 500, msg: error.message || '获取惩罚规则详情失败' })
  }
}

/**
 * 创建惩罚规则
 */
export async function createPenaltyRule(req, res) {
  try {
    const { penaltyName, penaltyType } = req.body
    
    if (!penaltyName) {
      return res.json({ errCode: 400, msg: '请输入惩罚名称' })
    }
    
    if (!penaltyType) {
      return res.json({ errCode: 400, msg: '请选择惩罚类型' })
    }
    
    const data = {
      ...req.body,
      createdBy: req.user?.id
    }
    
    const result = await model.createPenaltyRule(data)
    res.json({ errCode: 200, msg: '创建成功', data: result })
  } catch (error) {
    console.error('创建惩罚规则失败:', error)
    res.json({ errCode: 500, msg: error.message || '创建惩罚规则失败' })
  }
}

/**
 * 更新惩罚规则
 */
export async function updatePenaltyRule(req, res) {
  try {
    const { id } = req.params
    const success = await model.updatePenaltyRule(parseInt(id), req.body)
    
    if (!success) {
      return res.json({ errCode: 400, msg: '更新失败或规则不存在' })
    }
    
    res.json({ errCode: 200, msg: '更新成功' })
  } catch (error) {
    console.error('更新惩罚规则失败:', error)
    res.json({ errCode: 500, msg: error.message || '更新惩罚规则失败' })
  }
}

/**
 * 删除惩罚规则
 */
export async function deletePenaltyRule(req, res) {
  try {
    const { id } = req.params
    const success = await model.deletePenaltyRule(parseInt(id))
    
    if (!success) {
      return res.json({ errCode: 400, msg: '删除失败或规则不存在' })
    }
    
    res.json({ errCode: 200, msg: '删除成功' })
  } catch (error) {
    console.error('删除惩罚规则失败:', error)
    res.json({ errCode: 500, msg: error.message || '删除惩罚规则失败' })
  }
}

// ==================== 惩罚记录管理 ====================

/**
 * 获取惩罚记录列表
 */
export async function getPenaltyRecords(req, res) {
  try {
    const { 
      penaltyType, status, settlementMonth,
      supervisorId, salesId, documentId,
      startDate, endDate, page, pageSize 
    } = req.query
    
    const result = await model.getPenaltyRecords({
      penaltyType,
      status,
      settlementMonth,
      supervisorId: supervisorId ? parseInt(supervisorId) : undefined,
      salesId: salesId ? parseInt(salesId) : undefined,
      documentId: documentId ? parseInt(documentId) : undefined,
      startDate,
      endDate,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20
    })
    
    res.json({ errCode: 200, msg: 'success', data: result })
  } catch (error) {
    console.error('获取惩罚记录失败:', error)
    res.json({ errCode: 500, msg: error.message || '获取惩罚记录失败' })
  }
}

/**
 * 创建惩罚记录
 */
export async function createPenaltyRecord(req, res) {
  try {
    const { penaltyType, incidentDescription } = req.body
    
    if (!penaltyType) {
      return res.json({ errCode: 400, msg: '请选择惩罚类型' })
    }
    
    if (!incidentDescription) {
      return res.json({ errCode: 400, msg: '请填写事件描述' })
    }
    
    const data = {
      ...req.body,
      createdBy: req.user?.id
    }
    
    const result = await model.createPenaltyRecord(data)
    res.json({ errCode: 200, msg: '创建成功', data: result })
  } catch (error) {
    console.error('创建惩罚记录失败:', error)
    res.json({ errCode: 500, msg: error.message || '创建惩罚记录失败' })
  }
}

/**
 * 更新惩罚记录状态
 */
export async function updatePenaltyRecordStatus(req, res) {
  try {
    const { id } = req.params
    const { status, notes } = req.body
    
    if (!status) {
      return res.json({ errCode: 400, msg: '请选择状态' })
    }
    
    const success = await model.updatePenaltyRecordStatus(id, status, notes)
    
    if (!success) {
      return res.json({ errCode: 400, msg: '更新失败或记录不存在' })
    }
    
    res.json({ errCode: 200, msg: '更新成功' })
  } catch (error) {
    console.error('更新惩罚记录状态失败:', error)
    res.json({ errCode: 500, msg: error.message || '更新惩罚记录状态失败' })
  }
}

/**
 * 删除惩罚记录
 */
export async function deletePenaltyRecord(req, res) {
  try {
    const { id } = req.params
    const success = await model.deletePenaltyRecord(id)
    
    if (!success) {
      return res.json({ errCode: 400, msg: '删除失败或记录不存在' })
    }
    
    res.json({ errCode: 200, msg: '删除成功' })
  } catch (error) {
    console.error('删除惩罚记录失败:', error)
    res.json({ errCode: 500, msg: error.message || '删除惩罚记录失败' })
  }
}

// ==================== 方案配置 ====================

/**
 * 获取方案配置
 */
export async function getSchemeConfig(req, res) {
  try {
    const result = await model.getSchemeConfig()
    res.json({ errCode: 200, msg: 'success', data: result })
  } catch (error) {
    console.error('获取方案配置失败:', error)
    res.json({ errCode: 500, msg: error.message || '获取方案配置失败' })
  }
}

export default {
  // 规则管理
  getRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  
  // 惩罚规则管理
  getPenaltyRules,
  getPenaltyRuleById,
  createPenaltyRule,
  updatePenaltyRule,
  deletePenaltyRule,
  
  // 惩罚记录
  getPenaltyRecords,
  createPenaltyRecord,
  updatePenaltyRecordStatus,
  deletePenaltyRecord,
  
  // 方案配置
  getSchemeConfig,
  
  // 提成记录
  getRecords,
  getRecordById,
  calculateCommission,
  cancelRecord,
  
  // 结算管理
  getSettlements,
  getSettlementById,
  getSettlementsSummary,
  exportSettlement,
  generateSettlement,
  autoGenerateSettlements,
  batchSubmitSettlements,
  submitSettlement,
  approveSettlement,
  rejectSettlement,
  markSettlementPaid,
  
  // 统计
  getStats,
  getSalespersonRanking
}
