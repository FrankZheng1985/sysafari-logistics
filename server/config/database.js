/**
 * 数据库配置模块
 * 使用 PostgreSQL 作为唯一数据库
 * 
 * 使用方法：
 * - 本地开发：设置 DATABASE_URL 连接本地 PostgreSQL
 * - 生产环境：设置 DATABASE_URL 环境变量连接阿里云 RDS PostgreSQL
 */

import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量（确保在读取 DATABASE_URL 之前）
dotenv.config({ path: path.join(__dirname, '../.env') })

// 数据库架构：根据环境选择数据库
// 生产环境 (NODE_ENV=production): 使用 DATABASE_URL_PROD (生产数据库)
// 开发环境 (NODE_ENV=development): 使用 DATABASE_URL_TEST (测试数据库)
// 兼容旧配置: 如果设置了 DATABASE_URL，优先使用它
const isProduction = process.env.NODE_ENV === 'production'
const DATABASE_URL = process.env.DATABASE_URL || 
  (isProduction ? process.env.DATABASE_URL_PROD : process.env.DATABASE_URL_TEST)

// 检查数据库连接配置
if (!DATABASE_URL) {
  console.error('❌ 错误: 未配置数据库连接字符串')
  console.error('   请在 .env 文件中设置 DATABASE_URL 或 DATABASE_URL_TEST')
  process.exit(1)
}

// PostgreSQL 连接池
let pgPool = null

/**
 * 将 ? 占位符转换为 PostgreSQL 风格的 $1, $2...
 * (兼容旧代码的占位符格式)
 */
function convertPlaceholders(sql) {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}

/**
 * 将 datetime 函数转换为 PostgreSQL 标准语法
 * (兼容旧代码的日期时间函数)
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
    .replace(/datetime\s*\(\s*['"]now['"]\s*,\s*['"]localtime['"]\s*\)/gi, 'NOW()')
    // datetime('now') → NOW()
    .replace(/datetime\s*\(\s*['"]now['"]\s*\)/gi, 'NOW()')
    // CURRENT_TIMESTAMP → NOW()
    .replace(/CURRENT_TIMESTAMP/gi, 'NOW()')
}

/**
 * 提取括号内的内容（支持嵌套括号）
 */
function extractParenthesesContent(str, startIndex) {
  let depth = 0
  let start = -1
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === '(') {
      if (depth === 0) start = i + 1
      depth++
    } else if (str[i] === ')') {
      depth--
      if (depth === 0) {
        return { content: str.substring(start, i), endIndex: i }
      }
    }
  }
  return null
}

/**
 * 将 INSERT OR REPLACE 转换为 PostgreSQL 的 INSERT ON CONFLICT
 * (兼容旧代码的插入/替换语法)
 */
function convertInsertOrReplace(sql) {
  // 先检查是否包含 INSERT OR REPLACE
  if (!/INSERT\s+OR\s+REPLACE/i.test(sql)) {
    return sql
  }
  
  // 规范化 SQL：移除多余空白、换行
  const normalizedSql = sql.replace(/\s+/g, ' ').trim()
  
  // 提取表名
  const tableMatch = normalizedSql.match(/INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)/i)
  if (!tableMatch) {
    console.warn('⚠️ INSERT OR REPLACE 无法解析表名:', normalizedSql.substring(0, 100))
    return sql
  }
  const tableName = tableMatch[1]
  
  // 找到第一个括号（列名列表）
  const firstParenIndex = normalizedSql.indexOf('(', tableMatch.index + tableMatch[0].length)
  const columnsResult = extractParenthesesContent(normalizedSql, firstParenIndex)
  if (!columnsResult) {
    console.warn('⚠️ INSERT OR REPLACE 无法解析列名:', normalizedSql.substring(0, 100))
    return sql
  }
  const columns = columnsResult.content.split(',').map(c => c.trim())
  
  // 找到 VALUES 后的括号（值列表）
  const valuesIndex = normalizedSql.toUpperCase().indexOf('VALUES', columnsResult.endIndex)
  if (valuesIndex === -1) {
    console.warn('⚠️ INSERT OR REPLACE 无法找到 VALUES:', normalizedSql.substring(0, 100))
    return sql
  }
  const valuesParenIndex = normalizedSql.indexOf('(', valuesIndex)
  const valuesResult = extractParenthesesContent(normalizedSql, valuesParenIndex)
  if (!valuesResult) {
    console.warn('⚠️ INSERT OR REPLACE 无法解析值列表:', normalizedSql.substring(0, 100))
    return sql
  }
  const values = valuesResult.content
  
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
  return result
}

/**
 * 转换旧式 SQL 为 PostgreSQL 标准语法
 * (兼容层：处理历史代码中的非标准SQL)
 */
function convertLegacyToPostgres(sql) {
  let pgSql = sql
  pgSql = convertDateTimeFunctions(pgSql)
  pgSql = convertInsertOrReplace(pgSql)
  return pgSql
}

/**
 * PostgreSQL Statement 包装类
 * 提供同步风格的 API，内部使用 Promise
 */
class PgStatement {
  constructor(pool, sql) {
    this.pool = pool
    this.originalSql = sql
    // 先转换旧式语法，再转换占位符
    this.pgSql = convertPlaceholders(convertLegacyToPostgres(sql))
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
 * 提供统一的同步风格数据库访问 API
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
    // 执行 DDL 语句
    return this.pool.query(sql)
      .then(result => ({ changes: result.rowCount || 0 }))
      .catch(err => {
        // 忽略 "already exists" 等错误
        if (err.message.includes('already exists') || 
            err.message.includes('duplicate column') ||
            err.code === '42701') {
          return { changes: 0 }
        }
        console.error('❌ PostgreSQL exec 错误:', err.message)
        return { changes: 0 }
      })
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
    // 先转换旧式语法，再转换占位符
    const pgSql = convertPlaceholders(convertLegacyToPostgres(sql))
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
 */
export function getDatabase() {
  if (!pgPool) {
    // 判断数据库类型
    const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
    const isAliyunRDS = DATABASE_URL.includes('aliyuncs.com') || DATABASE_URL.includes('rds.aliyuncs')
    
    // SSL 配置：
    // - 本地开发：不使用 SSL
    // - 阿里云 RDS：使用 SSL
    // - 其他云服务：使用 SSL，不验证证书
    let sslConfig = false
    if (!isLocalhost) {
      if (isAliyunRDS) {
        // 阿里云 RDS SSL 配置
        // 如果需要严格验证证书，可以设置 rejectUnauthorized: true
        sslConfig = { rejectUnauthorized: false }
      } else if (DATABASE_URL.includes('sslmode=require') || isProduction) {
        // 其他云服务
        sslConfig = { rejectUnauthorized: false }
      }
    }
    
    pgPool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: sslConfig,
      max: 20,                        // 最大连接数
      min: 2,                         // 保持最小连接数，减少冷启动延迟
      idleTimeoutMillis: 60000,       // 空闲连接超时 60s
      connectionTimeoutMillis: 10000, // 连接超时 10s
      allowExitOnIdle: false,         // 防止空闲时退出连接池
    })
    
    pgPool.on('error', (err) => {
      console.error('❌ PostgreSQL 连接池错误:', err.message)
    })
    
    // 数据库心跳检查（每 5 分钟），防止连接休眠
    if (!isLocalhost) {
      setInterval(async () => {
        try {
          const client = await pgPool.connect()
          await client.query('SELECT 1')
          client.release()
          // 静默成功，减少日志噪音
        } catch (err) {
          console.error('💔 数据库心跳失败:', err.message)
        }
      }, 5 * 60 * 1000) // 5 分钟
    }
    
    // 数据库类型标识
    let dbProvider = '本地'
    if (!isLocalhost) {
      if (isAliyunRDS) dbProvider = '阿里云RDS'
      else dbProvider = '云端'
    }
    const dbType = isProduction ? '生产' : '开发'
    console.log(`🌐 PostgreSQL 数据库连接已建立 (${dbProvider} - ${dbType}环境)`)
  }
  return new PostgresDatabase(pgPool)
}

/**
 * 检查是否使用 PostgreSQL（始终返回 true）
 */
export function isUsingPostgres() {
  return true
}

/**
 * 关闭数据库连接
 */
export function closeDatabase() {
  if (pgPool) {
    pgPool.end()
    pgPool = null
    console.log('🌐 PostgreSQL 连接池已关闭')
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
}

/**
 * 直接执行 SQL 查询
 * @param {string} sql - SQL 语句（使用 $1, $2... 占位符）
 * @param {Array} params - 参数数组
 * @returns {Promise<{rows: Array, rowCount: number}>}
 */
export async function query(sql, params = []) {
  // 确保连接池已初始化
  getDatabase()
  try {
    const result = await pgPool.query(sql, params)
    return result
  } catch (error) {
    console.error('❌ SQL 查询错误:', error.message)
    console.error('   SQL:', sql)
    throw error
  }
}

export default {
  getDatabase,
  closeDatabase,
  transaction,
  generateId,
  testConnection,
  isUsingPostgres,
  query
}
