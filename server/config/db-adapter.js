/**
 * 数据库适配器层
 * 提供与 better-sqlite3 兼容的 API，底层支持 SQLite 和 PostgreSQL
 * 
 * 使用方法：
 * - 本地开发：使用 SQLite（默认）
 * - 生产环境：设置 DATABASE_URL 环境变量后自动使用 PostgreSQL
 */

import pg from 'pg'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 判断使用哪种数据库
const USE_POSTGRES = !!process.env.DATABASE_URL

/**
 * 将 SQLite 风格的 ? 占位符转换为 PostgreSQL 风格的 $1, $2...
 */
function convertPlaceholders(sql) {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}

/**
 * PostgreSQL 适配器 - 模拟 better-sqlite3 的 API
 */
class PostgresAdapter {
  constructor() {
    this.pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
    
    this.pool.on('error', (err) => {
      console.error('❌ PostgreSQL 连接池错误:', err.message)
    })
    
    console.log('📦 PostgreSQL 数据库适配器已初始化')
  }
  
  /**
   * 模拟 db.prepare(sql) - 返回一个 Statement 对象
   */
  prepare(sql) {
    const pgSql = convertPlaceholders(sql)
    return new PostgresStatement(this.pool, pgSql, sql)
  }
  
  /**
   * 模拟 db.exec(sql) - 执行多条 SQL（不返回结果）
   */
  exec(sql) {
    // PostgreSQL 不需要初始化表结构（已通过迁移脚本创建）
    // 这里只处理可能的 ALTER TABLE 等操作
    return { changes: 0 }
  }
  
  /**
   * 模拟 db.transaction(fn) - 事务
   */
  transaction(fn) {
    return async (...args) => {
      const client = await this.pool.connect()
      try {
        await client.query('BEGIN')
        // 创建一个临时的事务作用域适配器
        const txAdapter = new PostgresTransactionAdapter(client)
        const result = fn.call(txAdapter, ...args)
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
  
  /**
   * 关闭连接池
   */
  close() {
    return this.pool.end()
  }
}

/**
 * PostgreSQL Statement - 模拟 better-sqlite3 的 Statement
 */
class PostgresStatement {
  constructor(pool, pgSql, originalSql) {
    this.pool = pool
    this.pgSql = pgSql
    this.originalSql = originalSql
  }
  
  /**
   * 模拟 stmt.run(...params) - 执行 INSERT/UPDATE/DELETE
   */
  run(...params) {
    // 同步转异步的包装 - 使用 Promise 阻塞
    // 注意：这在生产环境中可能不是最佳实践，但可以保持 API 兼容性
    const result = this._runAsync(params)
    return result
  }
  
  async _runAsync(params) {
    try {
      const result = await this.pool.query(this.pgSql, params)
      return { 
        changes: result.rowCount,
        lastInsertRowid: result.rows[0]?.id || null
      }
    } catch (error) {
      // 忽略 "column already exists" 等错误（用于 ALTER TABLE ADD COLUMN）
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate column')) {
        return { changes: 0 }
      }
      console.error('❌ PostgreSQL run 错误:', error.message)
      console.error('   SQL:', this.pgSql)
      console.error('   参数:', params)
      throw error
    }
  }
  
  /**
   * 模拟 stmt.get(...params) - 获取单行
   */
  get(...params) {
    return this._getAsync(params)
  }
  
  async _getAsync(params) {
    try {
      const result = await this.pool.query(this.pgSql, params)
      return result.rows[0] || undefined
    } catch (error) {
      console.error('❌ PostgreSQL get 错误:', error.message)
      throw error
    }
  }
  
  /**
   * 模拟 stmt.all(...params) - 获取所有行
   */
  all(...params) {
    return this._allAsync(params)
  }
  
  async _allAsync(params) {
    try {
      const result = await this.pool.query(this.pgSql, params)
      return result.rows
    } catch (error) {
      console.error('❌ PostgreSQL all 错误:', error.message)
      throw error
    }
  }
}

/**
 * PostgreSQL 事务适配器
 */
class PostgresTransactionAdapter {
  constructor(client) {
    this.client = client
  }
  
  prepare(sql) {
    const pgSql = convertPlaceholders(sql)
    return new PostgresTransactionStatement(this.client, pgSql)
  }
}

class PostgresTransactionStatement {
  constructor(client, pgSql) {
    this.client = client
    this.pgSql = pgSql
  }
  
  async run(...params) {
    const result = await this.client.query(this.pgSql, params)
    return { changes: result.rowCount }
  }
  
  async get(...params) {
    const result = await this.client.query(this.pgSql, params)
    return result.rows[0]
  }
  
  async all(...params) {
    const result = await this.client.query(this.pgSql, params)
    return result.rows
  }
}

/**
 * SQLite 适配器 - 直接使用 better-sqlite3
 */
class SQLiteAdapter {
  constructor(dbPath) {
    this.db = new Database(dbPath)
    console.log('📦 SQLite 数据库适配器已初始化:', dbPath)
  }
  
  prepare(sql) {
    return this.db.prepare(sql)
  }
  
  exec(sql) {
    return this.db.exec(sql)
  }
  
  transaction(fn) {
    return this.db.transaction(fn)
  }
  
  close() {
    return this.db.close()
  }
}

/**
 * 创建数据库实例
 */
function createDatabase() {
  if (USE_POSTGRES) {
    console.log('🌐 使用 PostgreSQL 数据库 (Render)')
    return new PostgresAdapter()
  } else {
    const dbPath = join(__dirname, '../data/orders.db')
    console.log('💾 使用 SQLite 数据库 (本地)')
    return new SQLiteAdapter(dbPath)
  }
}

// 导出数据库实例
export const db = createDatabase()
export const isPostgres = USE_POSTGRES

export default db
