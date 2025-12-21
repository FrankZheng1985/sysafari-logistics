/**
 * 清关合同模板 - 数据模型
 * 包含配置管理、赔偿标准、保险配置、高峰期、合同记录等
 */

import { getDatabase } from '../../config/database.js'

// 获取数据库实例的辅助函数
const getDb = () => getDatabase()

// =====================================================
// 模板配置管理
// =====================================================

/**
 * 获取所有模板配置
 */
export async function getTemplateConfig() {
  const db = getDb()
  const result = await db.prepare(`
    SELECT config_key, config_value, config_type, description, updated_at
    FROM contract_template_config
    ORDER BY id
  `).all()
  
  // 转换为对象格式
  const config = {}
  for (const row of result) {
    let value = row.config_value
    if (row.config_type === 'number') {
      value = parseFloat(value)
    } else if (row.config_type === 'json') {
      try {
        value = JSON.parse(value)
      } catch (e) {
        // 保持原值
      }
    }
    config[row.config_key] = {
      value,
      type: row.config_type,
      description: row.description,
      updated_at: row.updated_at
    }
  }
  return config
}

/**
 * 获取单个配置项
 */
export async function getConfigValue(key) {
  const db = getDb()
  const row = await db.prepare(`
    SELECT config_value, config_type
    FROM contract_template_config
    WHERE config_key = ?
  `).get(key)
  
  if (!row) return null
  
  if (row.config_type === 'number') {
    return parseFloat(row.config_value)
  } else if (row.config_type === 'json') {
    try {
      return JSON.parse(row.config_value)
    } catch (e) {
      return row.config_value
    }
  }
  return row.config_value
}

/**
 * 更新配置项
 */
export async function updateConfig(key, value, description = null) {
  const db = getDb()
  const configValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
  
  if (description) {
    await db.prepare(`
      UPDATE contract_template_config 
      SET config_value = ?, description = ?, updated_at = NOW()
      WHERE config_key = ?
    `).run(configValue, description, key)
  } else {
    await db.prepare(`
      UPDATE contract_template_config 
      SET config_value = ?, updated_at = NOW()
      WHERE config_key = ?
    `).run(configValue, key)
  }
  
  return { success: true }
}

/**
 * 批量更新配置
 */
export async function updateConfigBatch(configs) {
  const db = getDb()
  
  for (const [key, value] of Object.entries(configs)) {
    const configValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
    await db.prepare(`
      UPDATE contract_template_config 
      SET config_value = ?, updated_at = NOW()
      WHERE config_key = ?
    `).run(configValue, key)
  }
  
  return { success: true }
}

// =====================================================
// 赔偿标准管理
// =====================================================

/**
 * 获取所有赔偿标准
 */
export async function getCompensationRules(activeOnly = true) {
  const db = getDb()
  let sql = `
    SELECT id, category, category_name, max_compensation, container_types, notes, is_active, created_at, updated_at
    FROM contract_compensation_rules
  `
  if (activeOnly) {
    sql += ' WHERE is_active = 1'
  }
  sql += ' ORDER BY id'
  
  return await db.prepare(sql).all()
}

/**
 * 获取单个赔偿标准
 */
export async function getCompensationRule(id) {
  const db = getDb()
  return await db.prepare(`
    SELECT id, category, category_name, max_compensation, container_types, notes, is_active
    FROM contract_compensation_rules
    WHERE id = ?
  `).get(id)
}

/**
 * 创建赔偿标准
 */
export async function createCompensationRule(data) {
  const db = getDb()
  const result = await db.prepare(`
    INSERT INTO contract_compensation_rules (category, category_name, max_compensation, container_types, notes, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.category,
    data.category_name,
    data.max_compensation || 0,
    data.container_types || '40GP,40HQ,45HC,45HQ',
    data.notes || '',
    data.is_active !== undefined ? data.is_active : 1
  )
  
  return { id: result.lastInsertRowid, ...data }
}

/**
 * 更新赔偿标准
 */
export async function updateCompensationRule(id, data) {
  const db = getDb()
  await db.prepare(`
    UPDATE contract_compensation_rules 
    SET category = ?, category_name = ?, max_compensation = ?, container_types = ?, notes = ?, is_active = ?, updated_at = NOW()
    WHERE id = ?
  `).run(
    data.category,
    data.category_name,
    data.max_compensation,
    data.container_types,
    data.notes,
    data.is_active,
    id
  )
  
  return { success: true }
}

/**
 * 删除赔偿标准（软删除）
 */
export async function deleteCompensationRule(id) {
  const db = getDb()
  await db.prepare(`
    UPDATE contract_compensation_rules SET is_active = 0 WHERE id = ?
  `).run(id)
  
  return { success: true }
}

// =====================================================
// 保险配置管理
// =====================================================

/**
 * 获取所有保险配置
 */
export async function getInsuranceConfig(activeOnly = true) {
  const db = getDb()
  let sql = `
    SELECT id, category, category_name, normal_cap, insured_cap, premium_per_10k, is_active
    FROM contract_insurance_config
  `
  if (activeOnly) {
    sql += ' WHERE is_active = 1'
  }
  sql += ' ORDER BY id'
  
  return await db.prepare(sql).all()
}

/**
 * 更新保险配置
 */
export async function updateInsuranceConfig(id, data) {
  const db = getDb()
  await db.prepare(`
    UPDATE contract_insurance_config 
    SET category_name = ?, normal_cap = ?, insured_cap = ?, premium_per_10k = ?, is_active = ?, updated_at = NOW()
    WHERE id = ?
  `).run(
    data.category_name,
    data.normal_cap,
    data.insured_cap,
    data.premium_per_10k,
    data.is_active,
    id
  )
  
  return { success: true }
}

/**
 * 批量更新保险配置
 */
export async function updateInsuranceConfigBatch(configs) {
  const db = getDb()
  
  for (const config of configs) {
    await db.prepare(`
      UPDATE contract_insurance_config 
      SET category_name = ?, normal_cap = ?, insured_cap = ?, premium_per_10k = ?, updated_at = NOW()
      WHERE id = ?
    `).run(
      config.category_name,
      config.normal_cap,
      config.insured_cap,
      config.premium_per_10k,
      config.id
    )
  }
  
  return { success: true }
}

// =====================================================
// 海运高峰期管理
// =====================================================

/**
 * 获取所有高峰期配置
 */
export async function getPeakSeasons(activeOnly = true) {
  const db = getDb()
  let sql = `
    SELECT id, season_name, start_month, start_day, end_month, end_day, notes, is_active
    FROM contract_peak_seasons
  `
  if (activeOnly) {
    sql += ' WHERE is_active = 1'
  }
  sql += ' ORDER BY start_month, start_day'
  
  return await db.prepare(sql).all()
}

/**
 * 创建高峰期
 */
export async function createPeakSeason(data) {
  const db = getDb()
  const result = await db.prepare(`
    INSERT INTO contract_peak_seasons (season_name, start_month, start_day, end_month, end_day, notes, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.season_name,
    data.start_month,
    data.start_day,
    data.end_month,
    data.end_day,
    data.notes || '',
    data.is_active !== undefined ? data.is_active : 1
  )
  
  return { id: result.lastInsertRowid, ...data }
}

/**
 * 更新高峰期
 */
export async function updatePeakSeason(id, data) {
  const db = getDb()
  await db.prepare(`
    UPDATE contract_peak_seasons 
    SET season_name = ?, start_month = ?, start_day = ?, end_month = ?, end_day = ?, notes = ?, is_active = ?
    WHERE id = ?
  `).run(
    data.season_name,
    data.start_month,
    data.start_day,
    data.end_month,
    data.end_day,
    data.notes,
    data.is_active,
    id
  )
  
  return { success: true }
}

/**
 * 删除高峰期
 */
export async function deletePeakSeason(id) {
  const db = getDb()
  await db.prepare(`
    DELETE FROM contract_peak_seasons WHERE id = ?
  `).run(id)
  
  return { success: true }
}

// =====================================================
// 合同管理
// =====================================================

/**
 * 生成合同编号
 * 格式: XF + 年份 + 5位序号
 */
export async function generateContractNo() {
  const db = getDb()
  const year = new Date().getFullYear()
  const prefix = `XF${year}`
  
  const lastContract = await db.prepare(`
    SELECT contract_no FROM customs_contracts 
    WHERE contract_no LIKE ?
    ORDER BY contract_no DESC
    LIMIT 1
  `).get(`${prefix}%`)
  
  let seq = 1
  if (lastContract) {
    const lastSeq = parseInt(lastContract.contract_no.slice(-5))
    seq = lastSeq + 1
  }
  
  return `${prefix}${String(seq).padStart(5, '0')}`
}

/**
 * 获取合同列表
 */
export async function getContracts(filters = {}) {
  const db = getDb()
  let sql = `
    SELECT 
      cc.id, cc.contract_no, cc.customer_id, cc.customer_name, cc.customer_company,
      cc.payment_days, cc.late_fee_rate, cc.max_overdue_days, cc.clearance_days,
      cc.status, cc.created_by, cc.approved_by, cc.approved_at, cc.reject_reason,
      cc.pdf_path, cc.valid_from, cc.valid_until, cc.created_at, cc.updated_at,
      u1.email as created_by_name,
      u2.email as approved_by_name
    FROM customs_contracts cc
    LEFT JOIN users u1 ON cc.created_by = u1.id
    LEFT JOIN users u2 ON cc.approved_by = u2.id
    WHERE 1=1
  `
  const params = []
  
  if (filters.status) {
    sql += ' AND cc.status = ?'
    params.push(filters.status)
  }
  
  if (filters.customer_id) {
    sql += ' AND cc.customer_id = ?'
    params.push(filters.customer_id)
  }
  
  if (filters.search) {
    sql += ' AND (cc.contract_no LIKE ? OR cc.customer_name LIKE ? OR cc.customer_company LIKE ?)'
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`)
  }
  
  sql += ' ORDER BY cc.created_at DESC'
  
  if (filters.limit) {
    sql += ' LIMIT ?'
    params.push(filters.limit)
  }
  
  return await db.prepare(sql).all(...params)
}

/**
 * 获取合同详情
 */
export async function getContract(id) {
  const db = getDb()
  return await db.prepare(`
    SELECT 
      cc.*,
      u1.email as created_by_name,
      u2.email as approved_by_name
    FROM customs_contracts cc
    LEFT JOIN users u1 ON cc.created_by = u1.id
    LEFT JOIN users u2 ON cc.approved_by = u2.id
    WHERE cc.id = ?
  `).get(id)
}

/**
 * 根据合同号获取合同
 */
export async function getContractByNo(contractNo) {
  const db = getDb()
  return await db.prepare(`
    SELECT * FROM customs_contracts WHERE contract_no = ?
  `).get(contractNo)
}

/**
 * 创建合同
 */
export async function createContract(data) {
  const db = getDb()
  
  // 生成合同编号
  const contractNo = await generateContractNo()
  
  // 获取当前配置作为快照
  const config = await getTemplateConfig()
  const compensationRules = await getCompensationRules()
  const insuranceConfig = await getInsuranceConfig()
  const peakSeasons = await getPeakSeasons()
  
  const result = await db.prepare(`
    INSERT INTO customs_contracts (
      contract_no, customer_id, customer_name, customer_company,
      payment_days, late_fee_rate, max_overdue_days, clearance_days,
      compensation_snapshot, insurance_snapshot, peak_seasons_snapshot, disclaimer_clauses,
      status, created_by, valid_from, valid_until
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    contractNo,
    data.customer_id,
    data.customer_name,
    data.customer_company,
    data.payment_days || config.payment_days?.value || 7,
    data.late_fee_rate || config.late_fee_rate?.value || 0.2,
    data.max_overdue_days || config.max_overdue_days?.value || 15,
    data.clearance_days || config.clearance_days?.value || 15,
    JSON.stringify(compensationRules),
    JSON.stringify(insuranceConfig),
    JSON.stringify(peakSeasons),
    JSON.stringify(config.disclaimer_clauses?.value || []),
    'draft',
    data.created_by,
    data.valid_from || new Date().toISOString().split('T')[0],
    data.valid_until || null
  )
  
  return {
    id: result.lastInsertRowid,
    contract_no: contractNo,
    status: 'draft'
  }
}

/**
 * 更新合同
 */
export async function updateContract(id, data) {
  const db = getDb()
  
  const fields = []
  const values = []
  
  const allowedFields = [
    'customer_name', 'customer_company', 'payment_days', 'late_fee_rate',
    'max_overdue_days', 'clearance_days', 'valid_from', 'valid_until'
  ]
  
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = ?`)
      values.push(data[field])
    }
  }
  
  if (fields.length === 0) {
    return { success: false, message: '没有可更新的字段' }
  }
  
  fields.push('updated_at = NOW()')
  values.push(id)
  
  await db.prepare(`
    UPDATE customs_contracts SET ${fields.join(', ')} WHERE id = ?
  `).run(...values)
  
  return { success: true }
}

/**
 * 提交合同审批
 */
export async function submitContract(id) {
  const db = getDb()
  await db.prepare(`
    UPDATE customs_contracts 
    SET status = 'pending', updated_at = NOW()
    WHERE id = ? AND status = 'draft'
  `).run(id)
  
  return { success: true }
}

/**
 * 审批通过
 */
export async function approveContract(id, approverId) {
  const db = getDb()
  await db.prepare(`
    UPDATE customs_contracts 
    SET status = 'approved', approved_by = ?, approved_at = NOW(), updated_at = NOW()
    WHERE id = ? AND status = 'pending'
  `).run(approverId, id)
  
  return { success: true }
}

/**
 * 审批驳回
 */
export async function rejectContract(id, approverId, reason) {
  const db = getDb()
  await db.prepare(`
    UPDATE customs_contracts 
    SET status = 'rejected', approved_by = ?, reject_reason = ?, updated_at = NOW()
    WHERE id = ? AND status = 'pending'
  `).run(approverId, reason, id)
  
  return { success: true }
}

/**
 * 更新PDF路径
 */
export async function updateContractPdfPath(id, pdfPath) {
  const db = getDb()
  await db.prepare(`
    UPDATE customs_contracts SET pdf_path = ?, updated_at = NOW() WHERE id = ?
  `).run(pdfPath, id)
  
  return { success: true }
}

/**
 * 删除合同（仅草稿状态）
 */
export async function deleteContract(id) {
  const db = getDb()
  const result = await db.prepare(`
    DELETE FROM customs_contracts WHERE id = ? AND status = 'draft'
  `).run(id)
  
  return { success: result.changes > 0 }
}

/**
 * 获取合同统计
 */
export async function getContractStats() {
  const db = getDb()
  
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
    FROM customs_contracts
  `).get()
  
  return stats
}

export default {
  // 配置管理
  getTemplateConfig,
  getConfigValue,
  updateConfig,
  updateConfigBatch,
  // 赔偿标准
  getCompensationRules,
  getCompensationRule,
  createCompensationRule,
  updateCompensationRule,
  deleteCompensationRule,
  // 保险配置
  getInsuranceConfig,
  updateInsuranceConfig,
  updateInsuranceConfigBatch,
  // 高峰期
  getPeakSeasons,
  createPeakSeason,
  updatePeakSeason,
  deletePeakSeason,
  // 合同管理
  generateContractNo,
  getContracts,
  getContract,
  getContractByNo,
  createContract,
  updateContract,
  submitContract,
  approveContract,
  rejectContract,
  updateContractPdfPath,
  deleteContract,
  getContractStats
}
