/**
 * 数据库配置模块
 * 支持 SQLite（本地开发）和 PostgreSQL（生产环境）
 * 
 * 使用方法：
 * - 本地开发：默认使用 SQLite
 * - 生产环境：设置 DATABASE_URL 环境变量后自动使用 PostgreSQL
 */

import Database from 'better-sqlite3'
import pg from 'pg'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 双数据库架构：根据环境选择数据库
// 生产环境 (NODE_ENV=production): 使用 DATABASE_URL_PROD (新的生产数据库)
// 开发环境 (NODE_ENV=development): 使用 DATABASE_URL_TEST (现有测试数据库)
// 兼容旧配置: 如果设置了 DATABASE_URL，优先使用它
const isProduction = process.env.NODE_ENV === 'production'
const DATABASE_URL = process.env.DATABASE_URL || 
  (isProduction ? process.env.DATABASE_URL_PROD : process.env.DATABASE_URL_TEST)

// 判断使用哪种数据库
const USE_POSTGRES = !!DATABASE_URL

// 确保数据目录存在（SQLite 用）
const dataDir = path.join(__dirname, '../data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// 数据库文件路径（SQLite）
export const DB_PATH = path.join(dataDir, 'orders.db')

// SQLite 实例
let sqliteDb = null

// PostgreSQL 连接池
let pgPool = null

/**
 * SQLite Statement 包装类 - 将同步 API 包装成 Promise
 */
class SqliteStatementWrapper {
  constructor(stmt) {
    this.stmt = stmt
  }
  
  run(...params) {
    return Promise.resolve(this.stmt.run(...params))
  }
  
  get(...params) {
    return Promise.resolve(this.stmt.get(...params))
  }
  
  all(...params) {
    return Promise.resolve(this.stmt.all(...params))
  }
}

/**
 * SQLite 数据库包装类 - 与 PostgreSQL 适配器 API 一致
 */
class SqliteDatabaseWrapper {
  constructor(db) {
    this.db = db
    this.isPostgres = false
  }
  
  prepare(sql) {
    return new SqliteStatementWrapper(this.db.prepare(sql))
  }
  
  exec(sql) {
    this.db.exec(sql)
    return Promise.resolve()
  }
  
  pragma(pragma) {
    return this.db.pragma(pragma)
  }
  
  transaction(fn) {
    return this.db.transaction(fn)
  }
  
  close() {
    this.db.close()
  }
}

/**
 * 将 SQLite 风格的 ? 占位符转换为 PostgreSQL 风格的 $1, $2...
 */
function convertPlaceholders(sql) {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}

/**
 * 将 SQLite 的 datetime 函数转换为 PostgreSQL 语法
 */
function convertDateTimeFunctions(sql) {
  return sql
    // datetime('now', '-' || ? || ' minutes') → NOW() - (? || ' minutes')::INTERVAL
    .replace(/datetime\s*\(\s*'now'\s*,\s*'-'\s*\|\|\s*\?\s*\|\|\s*'\s*minutes'\s*\)/gi, 
      "NOW() - (? || ' minutes')::INTERVAL")
    // datetime('now', '-1 minutes') → NOW() - INTERVAL '1 minutes'
    .replace(/datetime\s*\(\s*'now'\s*,\s*'-(\d+)\s*minutes'\s*\)/gi, 
      "NOW() - INTERVAL '$1 minutes'")
    // datetime('now', 'localtime') → NOW()
    .replace(/datetime\s*\(\s*'now'\s*,\s*'localtime'\s*\)/gi, 'NOW()')
    // datetime('now') → NOW()
    .replace(/datetime\s*\(\s*'now'\s*\)/gi, 'NOW()')
    // CURRENT_TIMESTAMP → NOW()
    .replace(/CURRENT_TIMESTAMP/gi, 'NOW()')
}

/**
 * 将 SQLite 的 INSERT OR REPLACE 转换为 PostgreSQL 的 INSERT ON CONFLICT
 */
function convertInsertOrReplace(sql) {
  // 先检查是否包含 INSERT OR REPLACE
  if (!/INSERT\s+OR\s+REPLACE/i.test(sql)) {
    return sql
  }
  
  // 规范化 SQL：移除多余空白、换行
  const normalizedSql = sql.replace(/\s+/g, ' ').trim()
  
  // 匹配 INSERT OR REPLACE INTO table (...) VALUES (...)
  const match = normalizedSql.match(/INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i)
  if (!match) {
    console.warn('⚠️ INSERT OR REPLACE 无法解析:', normalizedSql.substring(0, 100))
    return sql
  }
  
  const tableName = match[1]
  const columns = match[2].split(',').map(c => c.trim())
  const values = match[3]
  
  // 确定主键/唯一键列
  let conflictColumn = 'id'
  if (tableName === 'system_settings') {
    conflictColumn = 'setting_key'
  } else if (tableName === 'column_settings') {
    conflictColumn = 'id'
  } else if (tableName === 'role_permissions') {
    conflictColumn = 'role_code, permission_code'
  }
  
  // 生成 SET 子句（排除主键列）
  const conflictColumns = conflictColumn.split(',').map(c => c.trim())
  const setClauses = columns
    .filter(col => !conflictColumns.includes(col))
    .map(col => `${col} = EXCLUDED.${col}`)
    .join(', ')
  
  // 如果没有可更新的列，使用 DO NOTHING
  const doClause = setClauses ? `DO UPDATE SET ${setClauses}` : 'DO NOTHING'
  
  const result = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values}) ON CONFLICT (${conflictColumn}) ${doClause}`
  console.log('✅ SQL 转换成功:', result.substring(0, 80) + '...')
  return result
}

/**
 * 转换 SQLite SQL 为 PostgreSQL 兼容语法
 */
function convertSQLiteToPostgres(sql) {
  let pgSql = sql
  pgSql = convertDateTimeFunctions(pgSql)
  pgSql = convertInsertOrReplace(pgSql)
  return pgSql
}

/**
 * PostgreSQL Statement 包装类
 * 模拟 better-sqlite3 的同步 API，但内部使用 Promise
 */
class PgStatement {
  constructor(pool, sql) {
    this.pool = pool
    this.originalSql = sql
    // 先转换 SQLite 语法，再转换占位符
    this.pgSql = convertPlaceholders(convertSQLiteToPostgres(sql))
  }
  
  run(...params) {
    // 返回 Promise，调用者需要 await
    return this.pool.query(this.pgSql, params)
      .then(result => ({
        changes: result.rowCount,
        lastInsertRowid: result.rows[0]?.id || null
      }))
      .catch(err => {
        // 忽略 "already exists" 错误（用于 ALTER TABLE）
        if (err.message.includes('already exists') || 
            err.message.includes('duplicate column')) {
          return { changes: 0 }
        }
        console.error('❌ PG run error:', err.message)
        console.error('   SQL:', this.pgSql)
        throw err
      })
  }
  
  get(...params) {
    return this.pool.query(this.pgSql, params)
      .then(result => result.rows[0])
      .catch(err => {
        console.error('❌ PG get error:', err.message)
        throw err
      })
  }
  
  all(...params) {
    return this.pool.query(this.pgSql, params)
      .then(result => result.rows)
      .catch(err => {
        console.error('❌ PG all error:', err.message)
        throw err
      })
  }
}

/**
 * PostgreSQL 数据库适配器
 * 提供与 better-sqlite3 兼容的 API
 */
class PostgresDatabase {
  constructor(pool) {
    this.pool = pool
    this.isPostgres = true
  }
  
  prepare(sql) {
    return new PgStatement(this.pool, sql)
  }
  
  exec(sql) {
    // PostgreSQL 不需要执行初始化表结构（已通过迁移脚本创建）
    // 仅在本地开发时有效
    return Promise.resolve({ changes: 0 })
  }
  
  pragma(pragma) {
    // PostgreSQL 不支持 PRAGMA，忽略
    return null
  }
  
  transaction(fn) {
    // 返回一个异步函数
    return async (...args) => {
      const client = await this.pool.connect()
      try {
        await client.query('BEGIN')
        const txDb = new PostgresTransactionDb(client)
        const result = await fn.call(txDb, ...args)
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }
  }
  
  close() {
    return this.pool.end()
  }
}

/**
 * PostgreSQL 事务数据库适配器
 */
class PostgresTransactionDb {
  constructor(client) {
    this.client = client
    this.isPostgres = true
  }
  
  prepare(sql) {
    // 先转换 SQLite 语法，再转换占位符
    const pgSql = convertPlaceholders(convertSQLiteToPostgres(sql))
    return {
      run: async (...params) => {
        const result = await this.client.query(pgSql, params)
        return { changes: result.rowCount }
      },
      get: async (...params) => {
        const result = await this.client.query(pgSql, params)
        return result.rows[0]
      },
      all: async (...params) => {
        const result = await this.client.query(pgSql, params)
        return result.rows
      }
    }
  }
}

/**
 * 获取数据库实例（单例模式）
 * 根据环境变量自动选择 SQLite 或 PostgreSQL
 */
export function getDatabase() {
  if (USE_POSTGRES) {
    // PostgreSQL 模式
    if (!pgPool) {
      pgPool = new pg.Pool({
        connectionString: DATABASE_URL,
        // Render PostgreSQL 强制要求 SSL
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      })
      
      pgPool.on('error', (err) => {
        console.error('❌ PostgreSQL 连接池错误:', err.message)
      })
      
      const dbType = isProduction ? '生产' : '测试'
      console.log(`🌐 PostgreSQL 数据库连接已建立 (${dbType}环境)`)
    }
    return new PostgresDatabase(pgPool)
  } else {
    // SQLite 模式 - 使用包装类提供与 PostgreSQL 一致的 Promise API
    if (!sqliteDb) {
      const rawDb = new Database(DB_PATH)
      rawDb.pragma('foreign_keys = ON')
      rawDb.pragma('journal_mode = WAL')
      sqliteDb = new SqliteDatabaseWrapper(rawDb)
      console.log('💾 SQLite 数据库连接已建立:', DB_PATH)
    }
    return sqliteDb
  }
}

/**
 * 检查是否使用 PostgreSQL
 */
export function isUsingPostgres() {
  return USE_POSTGRES
}

/**
 * 关闭数据库连接
 */
export function closeDatabase() {
  if (USE_POSTGRES && pgPool) {
    pgPool.end()
    pgPool = null
    console.log('🌐 PostgreSQL 连接池已关闭')
  } else if (sqliteDb) {
    sqliteDb.close()
    sqliteDb = null
    console.log('💾 SQLite 数据库连接已关闭')
  }
}

/**
 * 执行事务
 * @param {Function} callback - 事务回调函数
 */
export function transaction(callback) {
  const database = getDatabase()
  if (USE_POSTGRES) {
    return database.transaction(callback)()
  }
  return database.transaction(callback)()
}

/**
 * 生成UUID
 */
export function generateId(prefix = '') {
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
  return prefix ? `${prefix}-${uuid}` : uuid
}

/**
 * 测试数据库连接
 */
export async function testConnection() {
  if (USE_POSTGRES) {
    // 确保连接池已初始化
    getDatabase()
    try {
      const client = await pgPool.connect()
      const result = await client.query('SELECT current_database() as db')
      console.log('✅ PostgreSQL 连接测试成功:', result.rows[0].db)
      client.release()
      return true
    } catch (error) {
      console.error('❌ PostgreSQL 连接测试失败:', error.message)
      return false
    }
  } else {
    console.log('✅ SQLite 连接测试成功')
    return true
  }
}

export default {
  getDatabase,
  closeDatabase,
  transaction,
  generateId,
  testConnection,
  isUsingPostgres,
  DB_PATH,
  USE_POSTGRES
}
