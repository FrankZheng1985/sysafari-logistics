/**
 * 单据编号生成器
 * 统一管理各类单据的编号生成
 */

import { getDatabase } from '../config/database.js'
import { SEQUENCE_RULES } from '../config/constants.js'

/**
 * 初始化序列表
 */
export async function initSequenceTable() {
  const db = getDatabase()
  
  // 确保序列表存在（使用 PostgreSQL 语法）
  await db.exec(`
    CREATE TABLE IF NOT EXISTS order_sequences (
      business_type TEXT PRIMARY KEY,
      current_seq INTEGER DEFAULT 0,
      prefix TEXT,
      description TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  
  // 初始化各业务类型的序列
  for (const [type, rule] of Object.entries(SEQUENCE_RULES)) {
    await db.prepare(`
      INSERT INTO order_sequences (business_type, prefix, description, current_seq)
      VALUES (?, ?, ?, 0)
      ON CONFLICT (business_type) DO NOTHING
    `).run(type, rule.prefix, rule.description)
  }
}

/**
 * 生成下一个序列号
 * @param {string} businessType - 业务类型（如 BILL, PKG, DEC 等）
 * @returns {Promise<string>} 格式化的序列号
 */
export async function getNextSequence(businessType) {
  const db = getDatabase()
  const rule = SEQUENCE_RULES[businessType]
  
  if (!rule) {
    throw new Error(`未知的业务类型: ${businessType}`)
  }
  
  // 获取当前年份
  const now = new Date()
  // 如果规则指定只用年份后两位（yearOnly: true），则只使用年份后两位
  // 否则使用完整的年月 YYYYMM
  const datePart = rule.yearOnly 
    ? String(now.getFullYear()).slice(-2) 
    : `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  
  // 原子性地获取并更新序列号
  const result = await db.transaction(async () => {
    // 获取当前序列号
    const row = await db.prepare(
      'SELECT current_seq FROM order_sequences WHERE business_type = ?'
    ).get(businessType)
    
    const nextSeq = (row?.current_seq || 0) + 1
    
    // 更新序列号（使用 PostgreSQL NOW() 函数）
    await db.prepare(
      'UPDATE order_sequences SET current_seq = ?, updated_at = NOW() WHERE business_type = ?'
    ).run(nextSeq, businessType)
    
    return nextSeq
  })()
  
  // 格式化序列号: PREFIX + 日期部分 + SEQ（补零）
  const seqStr = String(result).padStart(rule.length, '0')
  return `${rule.prefix}${datePart}${seqStr}`
}

/**
 * 生成简单序列号（不含年月）
 * @param {string} businessType - 业务类型
 * @returns {Promise<string>} 格式化的序列号
 */
export async function getSimpleSequence(businessType) {
  const db = getDatabase()
  const rule = SEQUENCE_RULES[businessType]
  
  if (!rule) {
    throw new Error(`未知的业务类型: ${businessType}`)
  }
  
  const result = await db.transaction(async () => {
    const row = await db.prepare(
      'SELECT current_seq FROM order_sequences WHERE business_type = ?'
    ).get(businessType)
    
    const nextSeq = (row?.current_seq || 0) + 1
    
    await db.prepare(
      'UPDATE order_sequences SET current_seq = ?, updated_at = NOW() WHERE business_type = ?'
    ).run(nextSeq, businessType)
    
    return nextSeq
  })()
  
  const seqStr = String(result).padStart(rule.length, '0')
  return `${rule.prefix}${seqStr}`
}

/**
 * 重置序列号（通常在新年或新月时使用）
 * @param {string} businessType - 业务类型
 */
export async function resetSequence(businessType) {
  const db = getDatabase()
  
  await db.prepare(
    'UPDATE order_sequences SET current_seq = 0, updated_at = NOW() WHERE business_type = ?'
  ).run(businessType)
}

/**
 * 获取当前序列号（不递增）
 * @param {string} businessType - 业务类型
 * @returns {Promise<number>} 当前序列号
 */
export async function getCurrentSequence(businessType) {
  const db = getDatabase()
  
  const row = await db.prepare(
    'SELECT current_seq FROM order_sequences WHERE business_type = ?'
  ).get(businessType)
  
  return row?.current_seq || 0
}

export default {
  initSequenceTable,
  getNextSequence,
  getSimpleSequence,
  resetSequence,
  getCurrentSequence
}
