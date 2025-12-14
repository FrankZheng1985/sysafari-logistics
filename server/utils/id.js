/**
 * ID 生成工具
 */

import crypto from 'crypto'

/**
 * 生成唯一 ID
 * @param {string} prefix - ID 前缀
 * @returns {string} 唯一 ID
 */
export function generateId(prefix = '') {
  const timestamp = Date.now().toString(36)
  const randomPart = crypto.randomBytes(4).toString('hex')
  return prefix ? `${prefix}_${timestamp}${randomPart}` : `${timestamp}${randomPart}`
}

/**
 * 生成 UUID
 * @returns {string} UUID
 */
export function generateUUID() {
  return crypto.randomUUID()
}

export default { generateId, generateUUID }

