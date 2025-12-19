/**
 * PostgreSQL 数据库配置模块
 * 用于 Render 云端部署
 */

import pg from 'pg'
const { Pool } = pg

// 从环境变量读取数据库连接字符串
const DATABASE_URL = process.env.DATABASE_URL

// 创建连接池
export const pool = new Pool({
  connectionString: DATABASE_URL,
  // Render 生产环境需要 SSL
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // 连接池配置
  max: 20,                    // 最大连接数
  idleTimeoutMillis: 30000,   // 空闲连接超时
  connectionTimeoutMillis: 2000, // 连接超时
})

// 监听连接池事件
pool.on('error', (err) => {
  console.error('❌ PostgreSQL 连接池错误:', err.message)
})

pool.on('connect', () => {
  console.log('📦 PostgreSQL 新连接已建立')
})

/**
 * 测试数据库连接
 */
export async function testConnection() {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT current_database() as db, current_user as user')
    console.log('✅ PostgreSQL 数据库连接成功')
    console.log(`📍 数据库: ${result.rows[0].db}`)
    console.log(`👤 用户: ${result.rows[0].user}`)
    client.release()
    return true
  } catch (error) {
    console.error('❌ PostgreSQL 数据库连接失败:', error.message)
    throw error
  }
}

/**
 * 执行查询
 * @param {string} text - SQL 语句
 * @param {Array} params - 参数数组
 */
export async function query(text, params) {
  const start = Date.now()
  try {
    const result = await pool.query(text, params)
    const duration = Date.now() - start
    // 开发环境下打印慢查询
    if (duration > 100) {
      console.log('⚠️ 慢查询:', { text, duration: `${duration}ms`, rows: result.rowCount })
    }
    return result
  } catch (error) {
    console.error('❌ 查询错误:', { text, error: error.message })
    throw error
  }
}

/**
 * 获取单个连接（用于事务）
 */
export async function getClient() {
  const client = await pool.connect()
  return client
}

/**
 * 执行事务
 * @param {Function} callback - 事务回调函数，接收 client 参数
 */
export async function transaction(callback) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * 关闭连接池
 */
export async function closePool() {
  await pool.end()
  console.log('📦 PostgreSQL 连接池已关闭')
}

/**
 * 生成 UUID
 */
export function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * 将 ? 占位符转换为 PostgreSQL 风格的 $1, $2...
 * (兼容旧代码的占位符格式)
 * @param {string} sql - 带 ? 占位符的 SQL
 */
export function convertPlaceholders(sql) {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}

export default {
  pool,
  query,
  getClient,
  transaction,
  testConnection,
  closePool,
  generateId,
  convertPlaceholders
}
