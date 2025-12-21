/**
 * 业务员提成模块 - 数据模型
 * 包含：提成规则管理、阶梯奖金、提成记录、月度结算
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== 常量定义 ====================

export const RULE_TYPE = {
  PERCENTAGE: 'percentage',   // 百分比提成
  FIXED: 'fixed',             // 固定金额
  TIERED: 'tiered'            // 阶梯奖金
}

export const COMMISSION_BASE = {
  CONTRACT_AMOUNT: 'contract_amount',   // 合同金额
  ORDER_AMOUNT: 'order_amount',         // 订单金额
  PROFIT: 'profit',                     // 利润
  RECEIVABLE: 'receivable'              // 回款金额
}

export const CUSTOMER_LEVEL = {
  VIP: 'vip',
  IMPORTANT: 'important',
  NORMAL: 'normal',
  POTENTIAL: 'potential',
  ALL: 'all'
}

export const RECORD_STATUS = {
  PENDING: 'pending',       // 待结算
  SETTLED: 'settled',       // 已结算
  CANCELLED: 'cancelled'    // 已取消
}

export const SETTLEMENT_STATUS = {
  DRAFT: 'draft',           // 草稿
  PENDING: 'pending',       // 待审批
  APPROVED: 'approved',     // 已审批
  REJECTED: 'rejected',     // 已驳回
  PAID: 'paid'              // 已发放
}

export const SOURCE_TYPE = {
  CONTRACT: 'contract',
  ORDER: 'order',
  PAYMENT: 'payment'
}

// ==================== 提成规则管理 ====================

/**
 * 获取提成规则列表
 */
export async function getRules(params = {}) {
  const db = getDatabase()
  const { ruleType, customerLevel, isActive, page = 1, pageSize = 50 } = params
  
  let query = 'SELECT * FROM commission_rules WHERE 1=1'
  const queryParams = []
  
  if (ruleType) {
    query += ' AND rule_type = ?'
    queryParams.push(ruleType)
  }
  
  if (customerLevel) {
    query += ' AND (customer_level = ? OR customer_level = ?)'
    queryParams.push(customerLevel, 'all')
  }
  
  if (isActive !== undefined) {
    query += ' AND is_active = ?'
    queryParams.push(isActive ? 1 : 0)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页和排序
  query += ' ORDER BY priority DESC, created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  // 获取每个规则的阶梯配置
  const rulesWithTiers = await Promise.all(list.map(async (rule) => {
    const converted = convertRuleToCamelCase(rule)
    if (rule.rule_type === 'tiered') {
      converted.tiers = await getRuleTiers(rule.id)
    }
    return converted
  }))
  
  return {
    list: rulesWithTiers,
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 根据ID获取规则
 */
export async function getRuleById(id) {
  const db = getDatabase()
  const rule = await db.prepare('SELECT * FROM commission_rules WHERE id = ?').get(id)
  if (!rule) return null
  
  const converted = convertRuleToCamelCase(rule)
  if (rule.rule_type === 'tiered') {
    converted.tiers = await getRuleTiers(id)
  }
  return converted
}

/**
 * 获取规则的阶梯配置
 */
export async function getRuleTiers(ruleId) {
  const db = getDatabase()
  const tiers = await db.prepare(`
    SELECT * FROM commission_tiers 
    WHERE rule_id = ? 
    ORDER BY tier_level ASC
  `).all(ruleId)
  
  return tiers.map(t => ({
    id: t.id,
    ruleId: t.rule_id,
    tierLevel: t.tier_level,
    minCount: t.min_count,
    maxCount: t.max_count,
    bonusAmount: t.bonus_amount
  }))
}

/**
 * 创建提成规则
 */
export async function createRule(data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    INSERT INTO commission_rules (
      rule_name, customer_level, rule_type, commission_base,
      commission_rate, fixed_amount, min_base_amount, max_commission,
      is_stackable, apply_to, is_active, priority, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    data.ruleName,
    data.customerLevel || 'all',
    data.ruleType,
    data.commissionBase || null,
    data.commissionRate || 0,
    data.fixedAmount || 0,
    data.minBaseAmount || 0,
    data.maxCommission || null,
    data.isStackable !== false ? 1 : 0,
    data.applyTo || 'all',
    data.isActive !== false ? 1 : 0,
    data.priority || 0,
    data.notes || '',
    data.createdBy || null
  )
  
  const ruleId = result.id
  
  // 如果是阶梯规则，创建阶梯配置
  if (data.ruleType === 'tiered' && data.tiers && data.tiers.length > 0) {
    await createRuleTiers(ruleId, data.tiers)
  }
  
  return { id: ruleId }
}

/**
 * 创建规则的阶梯配置
 */
async function createRuleTiers(ruleId, tiers) {
  const db = getDatabase()
  
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]
    await db.prepare(`
      INSERT INTO commission_tiers (rule_id, tier_level, min_count, max_count, bonus_amount)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      ruleId,
      tier.tierLevel || (i + 1),
      tier.minCount,
      tier.maxCount || null,
      tier.bonusAmount
    )
  }
}

/**
 * 更新提成规则
 */
export async function updateRule(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    ruleName: 'rule_name',
    customerLevel: 'customer_level',
    ruleType: 'rule_type',
    commissionBase: 'commission_base',
    commissionRate: 'commission_rate',
    fixedAmount: 'fixed_amount',
    minBaseAmount: 'min_base_amount',
    maxCommission: 'max_commission',
    isStackable: 'is_stackable',
    applyTo: 'apply_to',
    isActive: 'is_active',
    priority: 'priority',
    notes: 'notes'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      // 布尔值转换
      if (jsField === 'isStackable' || jsField === 'isActive') {
        values.push(data[jsField] ? 1 : 0)
      } else {
        values.push(data[jsField])
      }
    }
  })
  
  if (fields.length === 0 && !data.tiers) return false
  
  if (fields.length > 0) {
    fields.push("updated_at = NOW()")
    values.push(id)
    
    await db.prepare(`UPDATE commission_rules SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }
  
  // 更新阶梯配置
  if (data.tiers !== undefined) {
    // 删除旧的阶梯配置
    await db.prepare('DELETE FROM commission_tiers WHERE rule_id = ?').run(id)
    // 创建新的阶梯配置
    if (data.tiers && data.tiers.length > 0) {
      await createRuleTiers(id, data.tiers)
    }
  }
  
  return true
}

/**
 * 删除提成规则
 */
export async function deleteRule(id) {
  const db = getDatabase()
  // 阶梯配置会通过外键级联删除
  const result = await db.prepare('DELETE FROM commission_rules WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 获取适用于某客户级别的所有规则
 */
export async function getApplicableRules(customerLevel, sourceType = 'all') {
  const db = getDatabase()
  
  const rules = await db.prepare(`
    SELECT * FROM commission_rules 
    WHERE is_active = 1 
      AND (customer_level = ? OR customer_level = 'all')
      AND (apply_to = ? OR apply_to = 'all')
    ORDER BY priority DESC
  `).all(customerLevel, sourceType)
  
  // 获取阶梯配置
  const rulesWithTiers = await Promise.all(rules.map(async (rule) => {
    const converted = convertRuleToCamelCase(rule)
    if (rule.rule_type === 'tiered') {
      converted.tiers = await getRuleTiers(rule.id)
    }
    return converted
  }))
  
  return rulesWithTiers
}

// ==================== 提成记录管理 ====================

/**
 * 生成提成记录编号
 */
async function generateRecordNo() {
  const db = getDatabase()
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  
  const result = await db.prepare(`
    SELECT record_no FROM commission_records 
    WHERE record_no LIKE ? 
    ORDER BY record_no DESC LIMIT 1
  `).get(`CR${date}%`)
  
  let seq = 1
  if (result) {
    const lastSeq = parseInt(result.record_no.slice(-4))
    seq = lastSeq + 1
  }
  
  return `CR${date}${String(seq).padStart(4, '0')}`
}

/**
 * 获取提成记录列表
 */
export async function getRecords(params = {}) {
  const db = getDatabase()
  const { 
    salespersonId, customerId, settlementMonth, status,
    sourceType, startDate, endDate, search,
    page = 1, pageSize = 20 
  } = params
  
  let query = 'SELECT * FROM commission_records WHERE 1=1'
  const queryParams = []
  
  if (salespersonId) {
    query += ' AND salesperson_id = ?'
    queryParams.push(salespersonId)
  }
  
  if (customerId) {
    query += ' AND customer_id = ?'
    queryParams.push(customerId)
  }
  
  if (settlementMonth) {
    query += ' AND settlement_month = ?'
    queryParams.push(settlementMonth)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (sourceType) {
    query += ' AND source_type = ?'
    queryParams.push(sourceType)
  }
  
  if (startDate) {
    query += ' AND created_at >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND created_at <= ?'
    queryParams.push(endDate)
  }
  
  if (search) {
    query += ' AND (record_no LIKE ? OR customer_name LIKE ? OR salesperson_name LIKE ? OR source_no LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertRecordToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 根据ID获取提成记录
 */
export async function getRecordById(id) {
  const db = getDatabase()
  const record = await db.prepare('SELECT * FROM commission_records WHERE id = ?').get(id)
  return record ? convertRecordToCamelCase(record) : null
}

/**
 * 创建提成记录
 */
export async function createRecord(data) {
  const db = getDatabase()
  const id = generateId()
  const recordNo = await generateRecordNo()
  
  // 计算结算月份
  const settlementMonth = data.settlementMonth || new Date().toISOString().slice(0, 7)
  
  await db.prepare(`
    INSERT INTO commission_records (
      id, record_no, salesperson_id, salesperson_name,
      customer_id, customer_name, customer_level,
      rule_id, rule_name, rule_type, commission_base,
      base_amount, commission_rate, fixed_bonus, tier_bonus, commission_amount,
      source_type, source_id, source_no, settlement_month, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    recordNo,
    data.salespersonId,
    data.salespersonName || '',
    data.customerId || null,
    data.customerName || '',
    data.customerLevel || '',
    data.ruleId || null,
    data.ruleName || '',
    data.ruleType || '',
    data.commissionBase || '',
    data.baseAmount || 0,
    data.commissionRate || 0,
    data.fixedBonus || 0,
    data.tierBonus || 0,
    data.commissionAmount,
    data.sourceType,
    data.sourceId || null,
    data.sourceNo || '',
    settlementMonth,
    data.status || 'pending',
    data.notes || ''
  )
  
  return { id, recordNo }
}

/**
 * 更新提成记录状态
 */
export async function updateRecordStatus(id, status, settlementId = null) {
  const db = getDatabase()
  
  let query = 'UPDATE commission_records SET status = ?, updated_at = NOW()'
  const params = [status]
  
  if (settlementId) {
    query += ', settlement_id = ?'
    params.push(settlementId)
  }
  
  query += ' WHERE id = ?'
  params.push(id)
  
  const result = await db.prepare(query).run(...params)
  return result.changes > 0
}

/**
 * 取消提成记录
 */
export async function cancelRecord(id, reason = '') {
  const db = getDatabase()
  const result = await db.prepare(`
    UPDATE commission_records 
    SET status = 'cancelled', notes = COALESCE(notes, '') || ?, updated_at = NOW()
    WHERE id = ? AND status = 'pending'
  `).run(reason ? ` [取消原因: ${reason}]` : '', id)
  return result.changes > 0
}

/**
 * 获取业务员某月的单量统计
 */
export async function getSalespersonMonthlyCount(salespersonId, month) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM commission_records 
    WHERE salesperson_id = ? 
      AND settlement_month = ? 
      AND status != 'cancelled'
  `).get(salespersonId, month)
  
  return result?.count || 0
}

// ==================== 提成计算逻辑 ====================

/**
 * 计算单笔业务的提成
 * @param {Object} params 计算参数
 * @param {number} params.salespersonId 业务员ID
 * @param {string} params.salespersonName 业务员姓名
 * @param {string} params.customerId 客户ID
 * @param {string} params.customerName 客户名称
 * @param {string} params.customerLevel 客户级别
 * @param {string} params.sourceType 来源类型
 * @param {string} params.sourceId 来源ID
 * @param {string} params.sourceNo 来源单号
 * @param {number} params.amount 金额
 * @param {string} params.commissionBase 提成基数类型
 */
export async function calculateCommission(params) {
  const {
    salespersonId, salespersonName, customerId, customerName, customerLevel,
    sourceType, sourceId, sourceNo, amount, commissionBase = 'contract_amount'
  } = params
  
  // 获取适用的规则
  const rules = await getApplicableRules(customerLevel, sourceType)
  if (rules.length === 0) {
    return { records: [], totalCommission: 0 }
  }
  
  const records = []
  let totalCommission = 0
  const currentMonth = new Date().toISOString().slice(0, 7)
  
  // 获取当月单量（用于阶梯计算）
  const monthlyCount = await getSalespersonMonthlyCount(salespersonId, currentMonth)
  const currentOrderIndex = monthlyCount + 1
  
  for (const rule of rules) {
    let commissionAmount = 0
    let fixedBonus = 0
    let tierBonus = 0
    let rateCommission = 0
    
    // 检查最低基数要求
    if (rule.minBaseAmount && amount < rule.minBaseAmount) {
      continue
    }
    
    // 根据规则类型计算
    switch (rule.ruleType) {
      case 'percentage':
        // 百分比提成
        if (rule.commissionBase === commissionBase || rule.commissionBase === 'all') {
          rateCommission = amount * (rule.commissionRate / 100)
          // 检查封顶
          if (rule.maxCommission && rateCommission > rule.maxCommission) {
            rateCommission = rule.maxCommission
          }
          commissionAmount = rateCommission
        }
        break
        
      case 'fixed':
        // 固定金额
        fixedBonus = rule.fixedAmount || 0
        commissionAmount = fixedBonus
        break
        
      case 'tiered':
        // 阶梯奖金
        if (rule.tiers && rule.tiers.length > 0) {
          // 找到当前单量对应的阶梯
          const applicableTier = rule.tiers.find(tier => 
            currentOrderIndex >= tier.minCount && 
            (tier.maxCount === null || currentOrderIndex <= tier.maxCount)
          )
          if (applicableTier) {
            tierBonus = applicableTier.bonusAmount
            commissionAmount = tierBonus
          }
        }
        break
    }
    
    if (commissionAmount > 0) {
      // 创建提成记录
      const recordData = {
        salespersonId,
        salespersonName,
        customerId,
        customerName,
        customerLevel,
        ruleId: rule.id,
        ruleName: rule.ruleName,
        ruleType: rule.ruleType,
        commissionBase: rule.commissionBase || commissionBase,
        baseAmount: amount,
        commissionRate: rule.commissionRate || 0,
        fixedBonus,
        tierBonus,
        commissionAmount,
        sourceType,
        sourceId,
        sourceNo,
        settlementMonth: currentMonth
      }
      
      const { id, recordNo } = await createRecord(recordData)
      records.push({ id, recordNo, ...recordData })
      totalCommission += commissionAmount
      
      // 如果规则不可叠加，跳出循环
      if (!rule.isStackable) {
        break
      }
    }
  }
  
  return { records, totalCommission }
}

// ==================== 月度结算管理 ====================

/**
 * 生成结算单号
 */
async function generateSettlementNo(month) {
  const db = getDatabase()
  const monthStr = month.replace('-', '')
  
  const result = await db.prepare(`
    SELECT settlement_no FROM commission_settlements 
    WHERE settlement_no LIKE ? 
    ORDER BY settlement_no DESC LIMIT 1
  `).get(`CS${monthStr}%`)
  
  let seq = 1
  if (result) {
    const lastSeq = parseInt(result.settlement_no.slice(-4))
    seq = lastSeq + 1
  }
  
  return `CS${monthStr}${String(seq).padStart(4, '0')}`
}

/**
 * 获取结算单列表
 */
export async function getSettlements(params = {}) {
  const db = getDatabase()
  const { salespersonId, settlementMonth, status, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM commission_settlements WHERE 1=1'
  const queryParams = []
  
  if (salespersonId) {
    query += ' AND salesperson_id = ?'
    queryParams.push(salespersonId)
  }
  
  if (settlementMonth) {
    query += ' AND settlement_month = ?'
    queryParams.push(settlementMonth)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertSettlementToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 根据ID获取结算单
 */
export async function getSettlementById(id) {
  const db = getDatabase()
  const settlement = await db.prepare('SELECT * FROM commission_settlements WHERE id = ?').get(id)
  return settlement ? convertSettlementToCamelCase(settlement) : null
}

/**
 * 获取结算单汇总统计
 */
export async function getSettlementsSummary() {
  const db = getDatabase()
  
  try {
    const summary = await db.prepare(`
      SELECT 
        COALESCE(SUM(total_commission), 0) as total_reward,
        0 as total_penalty,
        COALESCE(SUM(total_commission), 0) as net_amount,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count
      FROM commission_settlements
    `).get()
    
    return {
      totalReward: summary?.total_reward || 0,
      totalPenalty: summary?.total_penalty || 0,
      netAmount: summary?.net_amount || 0,
      pendingCount: summary?.pending_count || 0,
      approvedCount: summary?.approved_count || 0,
      paidCount: summary?.paid_count || 0
    }
  } catch (error) {
    return {
      totalReward: 0,
      totalPenalty: 0,
      netAmount: 0,
      pendingCount: 0,
      approvedCount: 0,
      paidCount: 0
    }
  }
}

/**
 * 生成月度结算单（单个业务员）
 */
export async function generateSettlement(salespersonId, salespersonName, month) {
  const db = getDatabase()
  
  // 检查是否已存在该月结算单
  const existing = await db.prepare(`
    SELECT id FROM commission_settlements 
    WHERE salesperson_id = ? AND settlement_month = ?
  `).get(salespersonId, month)
  
  if (existing) {
    throw new Error(`${month} 月的结算单已存在`)
  }
  
  // 统计该月待结算的提成记录（奖励）
  const rewardStats = await db.prepare(`
    SELECT 
      COUNT(*) as record_count,
      COALESCE(SUM(base_amount), 0) as total_base_amount,
      COALESCE(SUM(commission_amount), 0) as total_commission
    FROM commission_records 
    WHERE salesperson_id = ? 
      AND settlement_month = ? 
      AND status = 'pending'
  `).get(salespersonId, month)
  
  // 统计该月已确认的惩罚记录
  let penaltyStats = { record_count: 0, total_penalty: 0 }
  try {
    penaltyStats = await db.prepare(`
      SELECT 
        COUNT(*) as record_count,
        COALESCE(SUM(total_penalty), 0) as total_penalty
      FROM commission_penalty_records 
      WHERE (supervisor_id = ? OR sales_id = ? OR document_id = ?)
        AND settlement_month = ? 
        AND status = 'confirmed'
    `).get(salespersonId, salespersonId, salespersonId, month) || penaltyStats
  } catch (e) {
    // 惩罚表可能不存在
  }
  
  if ((!rewardStats || rewardStats.record_count === 0) && penaltyStats.record_count === 0) {
    throw new Error(`${month} 月没有待结算的记录`)
  }
  
  // 创建结算单
  const id = generateId()
  const settlementNo = await generateSettlementNo(month)
  
  await db.prepare(`
    INSERT INTO commission_settlements (
      id, settlement_no, settlement_month, salesperson_id, salesperson_name,
      record_count, total_base_amount, total_commission, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')
  `).run(
    id,
    settlementNo,
    month,
    salespersonId,
    salespersonName,
    (rewardStats?.record_count || 0) + penaltyStats.record_count,
    rewardStats?.total_base_amount || 0,
    (rewardStats?.total_commission || 0) - penaltyStats.total_penalty
  )
  
  // 更新提成记录关联结算单
  if (rewardStats?.record_count > 0) {
    await db.prepare(`
      UPDATE commission_records 
      SET settlement_id = ?, updated_at = NOW()
      WHERE salesperson_id = ? AND settlement_month = ? AND status = 'pending'
    `).run(id, salespersonId, month)
  }
  
  // 更新惩罚记录关联结算单
  try {
    await db.prepare(`
      UPDATE commission_penalty_records 
      SET settlement_id = ?, updated_at = NOW()
      WHERE (supervisor_id = ? OR sales_id = ? OR document_id = ?)
        AND settlement_month = ? AND status = 'confirmed'
    `).run(id, salespersonId, salespersonId, salespersonId, month)
  } catch (e) {
    // 惩罚表可能不存在
  }
  
  return { id, settlementNo }
}

/**
 * 自动批量生成结算单（所有业务员）
 */
export async function autoGenerateSettlements(month) {
  const db = getDatabase()
  
  // 获取该月有待结算记录的所有业务员
  const salespersons = await db.prepare(`
    SELECT DISTINCT salesperson_id, salesperson_name
    FROM commission_records 
    WHERE settlement_month = ? AND status = 'pending'
  `).all(month)
  
  let successCount = 0
  const results = []
  
  for (const sp of salespersons) {
    try {
      // 检查是否已存在该月结算单
      const existing = await db.prepare(`
        SELECT id FROM commission_settlements 
        WHERE salesperson_id = ? AND settlement_month = ?
      `).get(sp.salesperson_id, month)
      
      if (!existing) {
        const result = await generateSettlement(sp.salesperson_id, sp.salesperson_name, month)
        results.push({ salespersonId: sp.salesperson_id, success: true, ...result })
        successCount++
      }
    } catch (error) {
      results.push({ salespersonId: sp.salesperson_id, success: false, error: error.message })
    }
  }
  
  return { count: successCount, results }
}

/**
 * 批量提交审批
 */
export async function batchSubmitSettlements(ids) {
  const db = getDatabase()
  let successCount = 0
  
  for (const id of ids) {
    const result = await db.prepare(`
      UPDATE commission_settlements 
      SET status = 'pending', submit_time = NOW(), updated_at = NOW()
      WHERE id = ? AND status = 'draft'
    `).run(id)
    if (result.changes > 0) successCount++
  }
  
  return { count: successCount }
}

/**
 * 提交结算单审批
 */
export async function submitSettlement(id) {
  const db = getDatabase()
  const result = await db.prepare(`
    UPDATE commission_settlements 
    SET status = 'pending', submit_time = NOW(), updated_at = NOW()
    WHERE id = ? AND status = 'draft'
  `).run(id)
  return result.changes > 0
}

/**
 * 审批结算单
 */
export async function approveSettlement(id, reviewerId, reviewerName, comment = '') {
  const db = getDatabase()
  
  // 更新结算单状态
  const result = await db.prepare(`
    UPDATE commission_settlements 
    SET status = 'approved', 
        reviewer_id = ?, 
        reviewer_name = ?, 
        review_time = NOW(), 
        review_comment = ?,
        updated_at = NOW()
    WHERE id = ? AND status = 'pending'
  `).run(reviewerId, reviewerName, comment, id)
  
  if (result.changes > 0) {
    // 更新关联的提成记录状态
    await db.prepare(`
      UPDATE commission_records 
      SET status = 'settled', updated_at = NOW()
      WHERE settlement_id = ?
    `).run(id)
  }
  
  return result.changes > 0
}

/**
 * 驳回结算单
 */
export async function rejectSettlement(id, reviewerId, reviewerName, comment) {
  const db = getDatabase()
  const result = await db.prepare(`
    UPDATE commission_settlements 
    SET status = 'rejected', 
        reviewer_id = ?, 
        reviewer_name = ?, 
        review_time = NOW(), 
        review_comment = ?,
        updated_at = NOW()
    WHERE id = ? AND status = 'pending'
  `).run(reviewerId, reviewerName, comment, id)
  return result.changes > 0
}

/**
 * 标记结算单已发放
 */
export async function markSettlementPaid(id) {
  const db = getDatabase()
  const result = await db.prepare(`
    UPDATE commission_settlements 
    SET status = 'paid', paid_time = NOW(), updated_at = NOW()
    WHERE id = ? AND status = 'approved'
  `).run(id)
  return result.changes > 0
}

// ==================== 统计分析 ====================

/**
 * 获取提成统计
 */
export async function getCommissionStats(params = {}) {
  const db = getDatabase()
  const { salespersonId, startMonth, endMonth } = params
  
  let whereClause = "WHERE status != 'cancelled'"
  const queryParams = []
  
  if (salespersonId) {
    whereClause += ' AND salesperson_id = ?'
    queryParams.push(salespersonId)
  }
  
  if (startMonth) {
    whereClause += ' AND settlement_month >= ?'
    queryParams.push(startMonth)
  }
  
  if (endMonth) {
    whereClause += ' AND settlement_month <= ?'
    queryParams.push(endMonth)
  }
  
  // 总体统计
  const totalStats = await db.prepare(`
    SELECT 
      COUNT(*) as total_records,
      COALESCE(SUM(base_amount), 0) as total_base_amount,
      COALESCE(SUM(commission_amount), 0) as total_commission,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) as pending_commission,
      COALESCE(SUM(CASE WHEN status = 'settled' THEN commission_amount ELSE 0 END), 0) as settled_commission
    FROM commission_records ${whereClause}
  `).get(...queryParams)
  
  // 按月统计
  const monthlyStats = await db.prepare(`
    SELECT 
      settlement_month,
      COUNT(*) as record_count,
      COALESCE(SUM(commission_amount), 0) as commission_amount
    FROM commission_records ${whereClause}
    GROUP BY settlement_month
    ORDER BY settlement_month DESC
    LIMIT 12
  `).all(...queryParams)
  
  // 按规则类型统计
  const byRuleType = await db.prepare(`
    SELECT 
      rule_type,
      COUNT(*) as record_count,
      COALESCE(SUM(commission_amount), 0) as commission_amount
    FROM commission_records ${whereClause}
    GROUP BY rule_type
  `).all(...queryParams)
  
  return {
    total: {
      records: totalStats.total_records || 0,
      baseAmount: totalStats.total_base_amount || 0,
      commission: totalStats.total_commission || 0,
      pendingCommission: totalStats.pending_commission || 0,
      settledCommission: totalStats.settled_commission || 0
    },
    monthly: monthlyStats.map(m => ({
      month: m.settlement_month,
      recordCount: m.record_count,
      commission: m.commission_amount
    })),
    byRuleType: byRuleType.map(r => ({
      ruleType: r.rule_type,
      recordCount: r.record_count,
      commission: r.commission_amount
    }))
  }
}

/**
 * 获取业务员排行
 */
export async function getSalespersonRanking(month, limit = 10) {
  const db = getDatabase()
  
  const ranking = await db.prepare(`
    SELECT 
      salesperson_id,
      salesperson_name,
      COUNT(*) as record_count,
      COALESCE(SUM(base_amount), 0) as total_base_amount,
      COALESCE(SUM(commission_amount), 0) as total_commission
    FROM commission_records 
    WHERE settlement_month = ? AND status != 'cancelled'
    GROUP BY salesperson_id, salesperson_name
    ORDER BY total_commission DESC
    LIMIT ?
  `).all(month, limit)
  
  return ranking.map((r, index) => ({
    rank: index + 1,
    salespersonId: r.salesperson_id,
    salespersonName: r.salesperson_name,
    recordCount: r.record_count,
    totalBaseAmount: r.total_base_amount,
    totalCommission: r.total_commission
  }))
}

// ==================== 数据转换函数 ====================

function convertRuleToCamelCase(row) {
  return {
    id: row.id,
    ruleName: row.rule_name,
    customerLevel: row.customer_level,
    ruleType: row.rule_type,
    commissionBase: row.commission_base,
    commissionRate: row.commission_rate,
    fixedAmount: row.fixed_amount,
    minBaseAmount: row.min_base_amount,
    maxCommission: row.max_commission,
    isStackable: row.is_stackable === 1,
    applyTo: row.apply_to,
    isActive: row.is_active === 1,
    priority: row.priority,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function convertRecordToCamelCase(row) {
  return {
    id: row.id,
    recordNo: row.record_no,
    salespersonId: row.salesperson_id,
    salespersonName: row.salesperson_name,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerLevel: row.customer_level,
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    ruleType: row.rule_type,
    commissionBase: row.commission_base,
    baseAmount: row.base_amount,
    commissionRate: row.commission_rate,
    fixedBonus: row.fixed_bonus,
    tierBonus: row.tier_bonus,
    commissionAmount: row.commission_amount,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceNo: row.source_no,
    settlementMonth: row.settlement_month,
    settlementId: row.settlement_id,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function convertSettlementToCamelCase(row) {
  return {
    id: row.id,
    settlementNo: row.settlement_no,
    settlementMonth: row.settlement_month,
    salespersonId: row.salesperson_id,
    salespersonName: row.salesperson_name,
    recordCount: row.record_count,
    totalBaseAmount: row.total_base_amount,
    totalCommission: row.total_commission,
    status: row.status,
    submitTime: row.submit_time,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name,
    reviewTime: row.review_time,
    reviewComment: row.review_comment,
    paidTime: row.paid_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ==================== 惩罚规则管理 ====================

export const PENALTY_TYPE = {
  INSPECTION: 'inspection',   // 查验惩罚
  MISTAKE: 'mistake',         // 工作失误
  LOSS: 'loss'               // 经济损失
}

export const PENALTY_RECORD_STATUS = {
  PENDING: 'pending',           // 待处理
  COMMUNICATED: 'communicated', // 已沟通（试用期）
  CONFIRMED: 'confirmed',       // 已确认
  SETTLED: 'settled',           // 已结算
  CANCELLED: 'cancelled'        // 已取消
}

/**
 * 获取惩罚规则列表
 */
export async function getPenaltyRules(params = {}) {
  const db = getDatabase()
  const { penaltyType, isActive } = params
  
  let query = 'SELECT * FROM commission_penalty_rules WHERE 1=1'
  const queryParams = []
  
  if (penaltyType) {
    query += ' AND penalty_type = ?'
    queryParams.push(penaltyType)
  }
  
  if (isActive !== undefined) {
    query += ' AND is_active = ?'
    queryParams.push(isActive ? 1 : 0)
  }
  
  query += ' ORDER BY created_at DESC'
  
  const list = await db.prepare(query).all(...queryParams)
  
  return list.map(convertPenaltyRuleToCamelCase)
}

/**
 * 根据ID获取惩罚规则
 */
export async function getPenaltyRuleById(id) {
  const db = getDatabase()
  const rule = await db.prepare('SELECT * FROM commission_penalty_rules WHERE id = ?').get(id)
  return rule ? convertPenaltyRuleToCamelCase(rule) : null
}

/**
 * 创建惩罚规则
 */
export async function createPenaltyRule(data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    INSERT INTO commission_penalty_rules (
      penalty_name, penalty_type, total_amount,
      supervisor_penalty, sales_penalty, document_penalty,
      loss_percentage, max_penalty_rate, is_active, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    data.penaltyName,
    data.penaltyType,
    data.totalAmount || 0,
    data.supervisorPenalty || 0,
    data.salesPenalty || 0,
    data.documentPenalty || 0,
    data.lossPercentage || 30,
    data.maxPenaltyRate || 100,
    data.isActive !== false ? 1 : 0,
    data.notes || '',
    data.createdBy || null
  )
  
  return { id: result.id }
}

/**
 * 更新惩罚规则
 */
export async function updatePenaltyRule(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    penaltyName: 'penalty_name',
    penaltyType: 'penalty_type',
    totalAmount: 'total_amount',
    supervisorPenalty: 'supervisor_penalty',
    salesPenalty: 'sales_penalty',
    documentPenalty: 'document_penalty',
    lossPercentage: 'loss_percentage',
    maxPenaltyRate: 'max_penalty_rate',
    isActive: 'is_active',
    notes: 'notes'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      if (jsField === 'isActive') {
        values.push(data[jsField] ? 1 : 0)
      } else {
        values.push(data[jsField])
      }
    }
  })
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = NOW()")
  values.push(id)
  
  const result = await db.prepare(`UPDATE commission_penalty_rules SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除惩罚规则
 */
export async function deletePenaltyRule(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM commission_penalty_rules WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 惩罚记录管理 ====================

/**
 * 生成惩罚记录编号
 */
async function generatePenaltyRecordNo() {
  const db = getDatabase()
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  
  const result = await db.prepare(`
    SELECT record_no FROM commission_penalty_records 
    WHERE record_no LIKE ? 
    ORDER BY record_no DESC LIMIT 1
  `).get(`PR${date}%`)
  
  let seq = 1
  if (result) {
    const lastSeq = parseInt(result.record_no.slice(-4))
    seq = lastSeq + 1
  }
  
  return `PR${date}${String(seq).padStart(4, '0')}`
}

/**
 * 获取惩罚记录列表
 */
export async function getPenaltyRecords(params = {}) {
  const db = getDatabase()
  const { 
    penaltyType, status, settlementMonth,
    supervisorId, salesId, documentId,
    startDate, endDate, page = 1, pageSize = 20 
  } = params
  
  let query = 'SELECT * FROM commission_penalty_records WHERE 1=1'
  const queryParams = []
  
  if (penaltyType) {
    query += ' AND penalty_type = ?'
    queryParams.push(penaltyType)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (settlementMonth) {
    query += ' AND settlement_month = ?'
    queryParams.push(settlementMonth)
  }
  
  if (supervisorId) {
    query += ' AND supervisor_id = ?'
    queryParams.push(supervisorId)
  }
  
  if (salesId) {
    query += ' AND sales_id = ?'
    queryParams.push(salesId)
  }
  
  if (documentId) {
    query += ' AND document_id = ?'
    queryParams.push(documentId)
  }
  
  if (startDate) {
    query += ' AND created_at >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND created_at <= ?'
    queryParams.push(endDate)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertPenaltyRecordToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 创建惩罚记录
 */
export async function createPenaltyRecord(data) {
  const db = getDatabase()
  const id = generateId()
  const recordNo = await generatePenaltyRecordNo()
  const settlementMonth = data.settlementMonth || new Date().toISOString().slice(0, 7)
  
  // 检查是否在试用期
  const schemeConfig = await getSchemeConfig()
  const startDate = new Date(schemeConfig.schemeStartDate)
  const today = new Date()
  const monthsDiff = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth())
  const isTrialPeriod = today >= startDate && monthsDiff < schemeConfig.penaltyTrialMonths
  
  await db.prepare(`
    INSERT INTO commission_penalty_records (
      id, record_no, penalty_rule_id, penalty_name, penalty_type,
      supervisor_id, supervisor_name, supervisor_penalty,
      sales_id, sales_name, sales_penalty,
      document_id, document_name, document_penalty,
      total_penalty, related_order_id, related_order_no, loss_amount,
      settlement_month, status, is_trial_period,
      incident_date, incident_description, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    recordNo,
    data.penaltyRuleId || null,
    data.penaltyName || '',
    data.penaltyType,
    data.supervisorId || null,
    data.supervisorName || '',
    data.supervisorPenalty || 0,
    data.salesId || null,
    data.salesName || '',
    data.salesPenalty || 0,
    data.documentId || null,
    data.documentName || '',
    data.documentPenalty || 0,
    data.totalPenalty || 0,
    data.relatedOrderId || null,
    data.relatedOrderNo || '',
    data.lossAmount || 0,
    settlementMonth,
    isTrialPeriod ? 'communicated' : 'pending',
    isTrialPeriod ? 1 : 0,
    data.incidentDate || new Date().toISOString().slice(0, 10),
    data.incidentDescription || '',
    data.notes || '',
    data.createdBy || null
  )
  
  return { id, recordNo, isTrialPeriod }
}

/**
 * 更新惩罚记录状态
 */
export async function updatePenaltyRecordStatus(id, status, notes = '') {
  const db = getDatabase()
  
  let query = 'UPDATE commission_penalty_records SET status = ?, updated_at = NOW()'
  const params = [status]
  
  if (notes) {
    query += ', notes = COALESCE(notes, \'\') || ?'
    params.push(` [${new Date().toISOString().slice(0, 10)}] ${notes}`)
  }
  
  query += ' WHERE id = ?'
  params.push(id)
  
  const result = await db.prepare(query).run(...params)
  return result.changes > 0
}

/**
 * 删除惩罚记录
 */
export async function deletePenaltyRecord(id) {
  const db = getDatabase()
  const result = await db.prepare(`
    DELETE FROM commission_penalty_records 
    WHERE id = ? AND status IN ('pending', 'communicated')
  `).run(id)
  return result.changes > 0
}

// ==================== 方案配置 ====================

/**
 * 获取方案配置
 */
export async function getSchemeConfig() {
  const db = getDatabase()
  
  try {
    const configs = await db.prepare('SELECT config_key, config_value FROM commission_scheme_config').all()
    
    const configMap = {}
    configs.forEach(c => {
      configMap[c.config_key] = c.config_value
    })
    
    return {
      schemeStartDate: configMap.scheme_start_date || '2025-12-01',
      penaltyTrialMonths: parseInt(configMap.penalty_trial_months) || 3,
      schemeMinDuration: parseInt(configMap.scheme_min_duration) || 6,
      schemeMaxDuration: parseInt(configMap.scheme_max_duration) || 12
    }
  } catch (error) {
    // 如果表不存在，返回默认配置
    return {
      schemeStartDate: '2025-12-01',
      penaltyTrialMonths: 3,
      schemeMinDuration: 6,
      schemeMaxDuration: 12
    }
  }
}

// ==================== 数据转换函数（惩罚相关） ====================

function convertPenaltyRuleToCamelCase(row) {
  return {
    id: row.id,
    penaltyName: row.penalty_name,
    penaltyType: row.penalty_type,
    totalAmount: row.total_amount,
    supervisorPenalty: row.supervisor_penalty,
    salesPenalty: row.sales_penalty,
    documentPenalty: row.document_penalty,
    lossPercentage: row.loss_percentage,
    maxPenaltyRate: row.max_penalty_rate,
    isActive: row.is_active === 1,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function convertPenaltyRecordToCamelCase(row) {
  return {
    id: row.id,
    recordNo: row.record_no,
    penaltyRuleId: row.penalty_rule_id,
    penaltyName: row.penalty_name,
    penaltyType: row.penalty_type,
    supervisorId: row.supervisor_id,
    supervisorName: row.supervisor_name,
    supervisorPenalty: row.supervisor_penalty,
    salesId: row.sales_id,
    salesName: row.sales_name,
    salesPenalty: row.sales_penalty,
    documentId: row.document_id,
    documentName: row.document_name,
    documentPenalty: row.document_penalty,
    totalPenalty: row.total_penalty,
    relatedOrderId: row.related_order_id,
    relatedOrderNo: row.related_order_no,
    lossAmount: row.loss_amount,
    settlementMonth: row.settlement_month,
    settlementId: row.settlement_id,
    status: row.status,
    isTrialPeriod: row.is_trial_period === 1,
    incidentDate: row.incident_date,
    incidentDescription: row.incident_description,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ==================== 导出 ====================

export default {
  // 常量
  RULE_TYPE,
  COMMISSION_BASE,
  CUSTOMER_LEVEL,
  RECORD_STATUS,
  SETTLEMENT_STATUS,
  SOURCE_TYPE,
  PENALTY_TYPE,
  PENALTY_RECORD_STATUS,
  
  // 规则管理
  getRules,
  getRuleById,
  getRuleTiers,
  createRule,
  updateRule,
  deleteRule,
  getApplicableRules,
  
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
  createRecord,
  updateRecordStatus,
  cancelRecord,
  getSalespersonMonthlyCount,
  
  // 提成计算
  calculateCommission,
  
  // 结算管理
  getSettlements,
  getSettlementById,
  getSettlementsSummary,
  generateSettlement,
  autoGenerateSettlements,
  batchSubmitSettlements,
  submitSettlement,
  approveSettlement,
  rejectSettlement,
  markSettlementPaid,
  
  // 统计分析
  getCommissionStats,
  getSalespersonRanking
}
