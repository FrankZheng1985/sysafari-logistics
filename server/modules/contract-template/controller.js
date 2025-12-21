/**
 * 清关合同模板 - 控制器
 */

import * as model from './model.js'

// =====================================================
// 模板配置控制器
// =====================================================

/**
 * 获取所有模板配置
 */
export async function getTemplateConfig(req, res) {
  try {
    const config = await model.getTemplateConfig()
    res.json({ success: true, data: config })
  } catch (error) {
    console.error('获取模板配置失败:', error)
    res.status(500).json({ success: false, message: '获取模板配置失败', error: error.message })
  }
}

/**
 * 更新模板配置
 */
export async function updateTemplateConfig(req, res) {
  try {
    const { configs } = req.body
    
    if (!configs || typeof configs !== 'object') {
      return res.status(400).json({ success: false, message: '缺少配置数据' })
    }
    
    await model.updateConfigBatch(configs)
    res.json({ success: true, message: '配置已更新' })
  } catch (error) {
    console.error('更新模板配置失败:', error)
    res.status(500).json({ success: false, message: '更新模板配置失败', error: error.message })
  }
}

// =====================================================
// 赔偿标准控制器
// =====================================================

/**
 * 获取赔偿标准列表
 */
export async function getCompensationRules(req, res) {
  try {
    const activeOnly = req.query.active !== 'false'
    const rules = await model.getCompensationRules(activeOnly)
    res.json({ success: true, data: rules })
  } catch (error) {
    console.error('获取赔偿标准失败:', error)
    res.status(500).json({ success: false, message: '获取赔偿标准失败', error: error.message })
  }
}

/**
 * 创建赔偿标准
 */
export async function createCompensationRule(req, res) {
  try {
    const { category, category_name, max_compensation, container_types, notes } = req.body
    
    if (!category || !category_name) {
      return res.status(400).json({ success: false, message: '缺少必要字段' })
    }
    
    const result = await model.createCompensationRule({
      category,
      category_name,
      max_compensation,
      container_types,
      notes
    })
    
    res.json({ success: true, data: result, message: '赔偿标准已创建' })
  } catch (error) {
    console.error('创建赔偿标准失败:', error)
    res.status(500).json({ success: false, message: '创建赔偿标准失败', error: error.message })
  }
}

/**
 * 更新赔偿标准
 */
export async function updateCompensationRule(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    await model.updateCompensationRule(id, data)
    res.json({ success: true, message: '赔偿标准已更新' })
  } catch (error) {
    console.error('更新赔偿标准失败:', error)
    res.status(500).json({ success: false, message: '更新赔偿标准失败', error: error.message })
  }
}

/**
 * 删除赔偿标准
 */
export async function deleteCompensationRule(req, res) {
  try {
    const { id } = req.params
    await model.deleteCompensationRule(id)
    res.json({ success: true, message: '赔偿标准已删除' })
  } catch (error) {
    console.error('删除赔偿标准失败:', error)
    res.status(500).json({ success: false, message: '删除赔偿标准失败', error: error.message })
  }
}

// =====================================================
// 保险配置控制器
// =====================================================

/**
 * 获取保险配置
 */
export async function getInsuranceConfig(req, res) {
  try {
    const activeOnly = req.query.active !== 'false'
    const config = await model.getInsuranceConfig(activeOnly)
    res.json({ success: true, data: config })
  } catch (error) {
    console.error('获取保险配置失败:', error)
    res.status(500).json({ success: false, message: '获取保险配置失败', error: error.message })
  }
}

/**
 * 更新保险配置
 */
export async function updateInsuranceConfig(req, res) {
  try {
    const { configs } = req.body
    
    if (Array.isArray(configs)) {
      await model.updateInsuranceConfigBatch(configs)
    } else {
      const { id } = req.params
      await model.updateInsuranceConfig(id, req.body)
    }
    
    res.json({ success: true, message: '保险配置已更新' })
  } catch (error) {
    console.error('更新保险配置失败:', error)
    res.status(500).json({ success: false, message: '更新保险配置失败', error: error.message })
  }
}

// =====================================================
// 高峰期控制器
// =====================================================

/**
 * 获取高峰期列表
 */
export async function getPeakSeasons(req, res) {
  try {
    const activeOnly = req.query.active !== 'false'
    const seasons = await model.getPeakSeasons(activeOnly)
    res.json({ success: true, data: seasons })
  } catch (error) {
    console.error('获取高峰期配置失败:', error)
    res.status(500).json({ success: false, message: '获取高峰期配置失败', error: error.message })
  }
}

/**
 * 创建高峰期
 */
export async function createPeakSeason(req, res) {
  try {
    const { season_name, start_month, start_day, end_month, end_day, notes } = req.body
    
    if (!start_month || !start_day || !end_month || !end_day) {
      return res.status(400).json({ success: false, message: '缺少日期信息' })
    }
    
    const result = await model.createPeakSeason({
      season_name,
      start_month,
      start_day,
      end_month,
      end_day,
      notes
    })
    
    res.json({ success: true, data: result, message: '高峰期已创建' })
  } catch (error) {
    console.error('创建高峰期失败:', error)
    res.status(500).json({ success: false, message: '创建高峰期失败', error: error.message })
  }
}

/**
 * 更新高峰期
 */
export async function updatePeakSeason(req, res) {
  try {
    const { id } = req.params
    await model.updatePeakSeason(id, req.body)
    res.json({ success: true, message: '高峰期已更新' })
  } catch (error) {
    console.error('更新高峰期失败:', error)
    res.status(500).json({ success: false, message: '更新高峰期失败', error: error.message })
  }
}

/**
 * 删除高峰期
 */
export async function deletePeakSeason(req, res) {
  try {
    const { id } = req.params
    await model.deletePeakSeason(id)
    res.json({ success: true, message: '高峰期已删除' })
  } catch (error) {
    console.error('删除高峰期失败:', error)
    res.status(500).json({ success: false, message: '删除高峰期失败', error: error.message })
  }
}

// =====================================================
// 合同控制器
// =====================================================

/**
 * 获取合同列表
 */
export async function getContracts(req, res) {
  try {
    const { status, customer_id, search, limit } = req.query
    const contracts = await model.getContracts({
      status,
      customer_id: customer_id ? parseInt(customer_id) : null,
      search,
      limit: limit ? parseInt(limit) : null
    })
    res.json({ success: true, data: contracts })
  } catch (error) {
    console.error('获取合同列表失败:', error)
    res.status(500).json({ success: false, message: '获取合同列表失败', error: error.message })
  }
}

/**
 * 获取合同详情
 */
export async function getContract(req, res) {
  try {
    const { id } = req.params
    const contract = await model.getContract(id)
    
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' })
    }
    
    // 解析JSON字段
    if (contract.compensation_snapshot) {
      contract.compensation_snapshot = JSON.parse(contract.compensation_snapshot)
    }
    if (contract.insurance_snapshot) {
      contract.insurance_snapshot = JSON.parse(contract.insurance_snapshot)
    }
    if (contract.peak_seasons_snapshot) {
      contract.peak_seasons_snapshot = JSON.parse(contract.peak_seasons_snapshot)
    }
    if (contract.disclaimer_clauses) {
      contract.disclaimer_clauses = JSON.parse(contract.disclaimer_clauses)
    }
    
    res.json({ success: true, data: contract })
  } catch (error) {
    console.error('获取合同详情失败:', error)
    res.status(500).json({ success: false, message: '获取合同详情失败', error: error.message })
  }
}

/**
 * 创建合同
 */
export async function createContract(req, res) {
  try {
    const { customer_id, customer_name, customer_company, payment_days, late_fee_rate, max_overdue_days, clearance_days, valid_from, valid_until } = req.body
    
    if (!customer_id && !customer_name) {
      return res.status(400).json({ success: false, message: '缺少客户信息' })
    }
    
    // 从认证中获取当前用户ID
    const created_by = req.user?.id || 1
    
    const result = await model.createContract({
      customer_id,
      customer_name,
      customer_company,
      payment_days,
      late_fee_rate,
      max_overdue_days,
      clearance_days,
      valid_from,
      valid_until,
      created_by
    })
    
    res.json({ success: true, data: result, message: '合同已创建' })
  } catch (error) {
    console.error('创建合同失败:', error)
    res.status(500).json({ success: false, message: '创建合同失败', error: error.message })
  }
}

/**
 * 更新合同
 */
export async function updateContract(req, res) {
  try {
    const { id } = req.params
    const contract = await model.getContract(id)
    
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' })
    }
    
    if (contract.status !== 'draft') {
      return res.status(400).json({ success: false, message: '只能修改草稿状态的合同' })
    }
    
    await model.updateContract(id, req.body)
    res.json({ success: true, message: '合同已更新' })
  } catch (error) {
    console.error('更新合同失败:', error)
    res.status(500).json({ success: false, message: '更新合同失败', error: error.message })
  }
}

/**
 * 提交合同审批
 */
export async function submitContract(req, res) {
  try {
    const { id } = req.params
    const contract = await model.getContract(id)
    
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' })
    }
    
    if (contract.status !== 'draft') {
      return res.status(400).json({ success: false, message: '只能提交草稿状态的合同' })
    }
    
    await model.submitContract(id)
    res.json({ success: true, message: '合同已提交审批' })
  } catch (error) {
    console.error('提交合同审批失败:', error)
    res.status(500).json({ success: false, message: '提交合同审批失败', error: error.message })
  }
}

/**
 * 审批通过
 */
export async function approveContract(req, res) {
  try {
    const { id } = req.params
    const contract = await model.getContract(id)
    
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' })
    }
    
    if (contract.status !== 'pending') {
      return res.status(400).json({ success: false, message: '只能审批待审批状态的合同' })
    }
    
    const approverId = req.user?.id || 1
    await model.approveContract(id, approverId)
    res.json({ success: true, message: '合同已审批通过' })
  } catch (error) {
    console.error('审批通过失败:', error)
    res.status(500).json({ success: false, message: '审批通过失败', error: error.message })
  }
}

/**
 * 审批驳回
 */
export async function rejectContract(req, res) {
  try {
    const { id } = req.params
    const { reason } = req.body
    
    const contract = await model.getContract(id)
    
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' })
    }
    
    if (contract.status !== 'pending') {
      return res.status(400).json({ success: false, message: '只能驳回待审批状态的合同' })
    }
    
    const approverId = req.user?.id || 1
    await model.rejectContract(id, approverId, reason || '')
    res.json({ success: true, message: '合同已驳回' })
  } catch (error) {
    console.error('审批驳回失败:', error)
    res.status(500).json({ success: false, message: '审批驳回失败', error: error.message })
  }
}

/**
 * 删除合同
 */
export async function deleteContract(req, res) {
  try {
    const { id } = req.params
    const result = await model.deleteContract(id)
    
    if (!result.success) {
      return res.status(400).json({ success: false, message: '只能删除草稿状态的合同' })
    }
    
    res.json({ success: true, message: '合同已删除' })
  } catch (error) {
    console.error('删除合同失败:', error)
    res.status(500).json({ success: false, message: '删除合同失败', error: error.message })
  }
}

/**
 * 获取合同统计
 */
export async function getContractStats(req, res) {
  try {
    const stats = await model.getContractStats()
    res.json({ success: true, data: stats })
  } catch (error) {
    console.error('获取合同统计失败:', error)
    res.status(500).json({ success: false, message: '获取合同统计失败', error: error.message })
  }
}

export default {
  // 配置
  getTemplateConfig,
  updateTemplateConfig,
  // 赔偿标准
  getCompensationRules,
  createCompensationRule,
  updateCompensationRule,
  deleteCompensationRule,
  // 保险配置
  getInsuranceConfig,
  updateInsuranceConfig,
  // 高峰期
  getPeakSeasons,
  createPeakSeason,
  updatePeakSeason,
  deletePeakSeason,
  // 合同
  getContracts,
  getContract,
  createContract,
  updateContract,
  submitContract,
  approveContract,
  rejectContract,
  deleteContract,
  getContractStats
}
