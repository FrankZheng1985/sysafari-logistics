/**
 * 数据库配置模块
 * 统一管理数据库连接和初始化
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 确保数据目录存在
const dataDir = path.join(__dirname, '../data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// 数据库文件路径
export const DB_PATH = path.join(dataDir, 'orders.db')

// 创建数据库连接
let db = null

/**
 * 获取数据库实例（单例模式）
 */
export function getDatabase() {
  if (!db) {
    db = new Database(DB_PATH)
    // 启用外键约束
    db.pragma('foreign_keys = ON')
    // 启用WAL模式提升性能
    db.pragma('journal_mode = WAL')
    console.log('📦 数据库连接已建立:', DB_PATH)
  }
  return db
}

/**
 * 关闭数据库连接
 */
export function closeDatabase() {
  if (db) {
    db.close()
    db = null
    console.log('📦 数据库连接已关闭')
  }
}

/**
 * 执行事务
 * @param {Function} callback - 事务回调函数
 */
export function transaction(callback) {
  const database = getDatabase()
  return database.transaction(callback)()
}

/**
 * 生成UUID
 */
export function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export default {
  getDatabase,
  closeDatabase,
  transaction,
  generateId,
  DB_PATH
}
