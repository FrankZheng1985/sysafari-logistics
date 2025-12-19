/**
 * 数据库适配器层
 * 使用 PostgreSQL 作为唯一数据库
 * 
 * 使用方法：
 * - 本地开发：设置 DATABASE_URL 连接本地 PostgreSQL
 * - 生产环境：设置 DATABASE_URL 环境变量连接 Render PostgreSQL
 */

import pg from 'pg'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载环境变量
dotenv.config({ path: join(__dirname, '../.env') })

// 获取数据库连接字符串
const isProduction = process.env.NODE_ENV === 'production'
const DATABASE_URL = process.env.DATABASE_URL || 
  (isProduction ? process.env.DATABASE_URL_PROD : process.env.DATABASE_URL_TEST)

// 检查数据库连接配置
if (!DATABASE_URL) {
  console.error('❌ 错误: 未配置数据库连接字符串')
  console.error('   请在 .env 文件中设置 DATABASE_URL 或 DATABASE_URL_TEST')
  process.exit(1)
}

/**
 * 将 ? 占位符转换为 PostgreSQL 风格的 $1, $2...
 * (兼容旧代码的占位符格式)
 */
function convertPlaceholders(sql) {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}

/**
 * 将旧式语法转换为 PostgreSQL 标准语法
 * (兼容层：处理历史代码中的非标准SQL)
 */
function convertLegacyToPG(sql) {
  let pgSql = sql
  
  // datetime('now', 'localtime') → NOW()
  pgSql = pgSql.replace(/datetime\s*\(\s*['"]now['"]\s*,\s*['"]localtime['"]\s*\)/gi, 'NOW()')
  
  // datetime('now') → NOW()
  pgSql = pgSql.replace(/datetime\s*\(\s*['"]now['"]\s*\)/gi, 'NOW()')
  
  // CURRENT_TIMESTAMP → NOW() (统一使用 NOW())
  pgSql = pgSql.replace(/CURRENT_TIMESTAMP/gi, 'NOW()')
  
  // INSERT OR REPLACE INTO table (...) VALUES (...)
  //    → INSERT INTO table (...) VALUES (...) ON CONFLICT (primary_key) DO UPDATE SET ...
  const insertOrReplaceMatch = pgSql.match(/INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i)
  if (insertOrReplaceMatch) {
    const tableName = insertOrReplaceMatch[1]
    const columns = insertOrReplaceMatch[2].split(',').map(c => c.trim())
    const values = insertOrReplaceMatch[3]
    
    // 确定主键列（通常是第一列或 id/setting_key 等）
    let primaryKey = 'id'
    if (tableName === 'system_settings') {
      primaryKey = 'setting_key'
    } else if (tableName === 'column_settings') {
      primaryKey = 'id'
    }
    
    // 生成 SET 子句（排除主键列）
    const setClauses = columns
      .filter(col => col !== primaryKey)
      .map(col => `${col} = EXCLUDED.${col}`)
      .join(', ')
    
    pgSql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values}) ON CONFLICT (${primaryKey}) DO UPDATE SET ${setClauses}`
  }
  
  // 4. INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING
  pgSql = pgSql.replace(/INSERT\s+OR\s+IGNORE/gi, 'INSERT')
  
  return pgSql
}

/**
 * PostgreSQL 适配器 - 提供统一的同步风格数据库访问 API
 */
class PostgresAdapter {
  constructor() {
    // 判断是否需要 SSL（本地连接不需要，Render 连接需要）
    const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
    const needSSL = !isLocalhost && (DATABASE_URL.includes('sslmode=require') || isProduction)
    
    this.pool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: needSSL ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
    
    // 标记为 PostgreSQL 数据库
    this.isPostgres = true
    
    this.pool.on('error', (err) => {
      console.error('❌ PostgreSQL 连接池错误:', err.message)
    })
    
    console.log('📦 PostgreSQL 数据库适配器已初始化')
  }
  
  /**
   * db.prepare(sql) - 返回一个 Statement 对象
   */
  prepare(sql) {
    // 先转换旧式语法，再转换占位符
    const convertedSql = convertLegacyToPG(sql)
    const pgSql = convertPlaceholders(convertedSql)
    return new PostgresStatement(this.pool, pgSql, sql)
  }
  
  /**
   * db.exec(sql) - 执行多条 SQL（不返回结果）
   */
  exec(sql) {
    return this._execAsync(sql)
  }
  
  async _execAsync(sql) {
    try {
      const result = await this.pool.query(sql)
      return { changes: result.rowCount || 0 }
    } catch (error) {
      // 忽略 "column already exists" 等错误
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate column') ||
          error.code === '42701') { // PostgreSQL 的 "column already exists" 错误码
        return { changes: 0 }
      }
      console.error('❌ PostgreSQL exec 错误:', error.message)
      // 不抛出错误，让迁移继续进行
      return { changes: 0 }
    }
  }
  
  /**
   * db.transaction(fn) - 事务
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
 * PostgreSQL Statement - 提供同步风格的 SQL 执行 API
 */
class PostgresStatement {
  constructor(pool, pgSql, originalSql) {
    this.pool = pool
    this.pgSql = pgSql
    this.originalSql = originalSql
  }
  
  /**
   * stmt.run(...params) - 执行 INSERT/UPDATE/DELETE
   */
  run(...params) {
    return this._runAsync(params)
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
   * stmt.get(...params) - 获取单行
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
   * stmt.all(...params) - 获取所有行
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
    // 先转换旧式语法，再转换占位符
    const convertedSql = convertLegacyToPG(sql)
    const pgSql = convertPlaceholders(convertedSql)
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
 * 创建数据库实例
 */
function createDatabase() {
  console.log('🌐 使用 PostgreSQL 数据库')
  return new PostgresAdapter()
}

// 导出数据库实例
export const db = createDatabase()
export const isPostgres = true

export default db
