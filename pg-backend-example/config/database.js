/**
 * PostgreSQL 数据库配置模块
 * 使用 pg 库的连接池管理数据库连接
 */

import pg from 'pg'
const { Pool } = pg

// 创建连接池 - 从 DATABASE_URL 读取连接字符串
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 生产环境启用 SSL（Render、Heroku 等云服务需要）
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

// 监听连接池错误
pool.on('error', (err) => {
  console.error('❌ PostgreSQL 连接池错误:', err)
})

// 监听连接事件（调试用）
pool.on('connect', () => {
  console.log('📦 新的数据库连接已建立')
})

/**
 * 测试数据库连接
 */
export async function testConnection() {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT current_database() as db')
    console.log('✅ PostgreSQL 数据库连接成功')
    console.log(`📍 数据库: ${result.rows[0].db}`)
    client.release()
    return true
  } catch (error) {
    console.error('❌ PostgreSQL 数据库连接失败:', error.message)
    throw error
  }
}

/**
 * 执行事务
 * @param {Function} callback - 事务回调函数，接收client参数
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
  console.log('📦 数据库连接池已关闭')
}

export default {
  pool,
  testConnection,
  transaction,
  closePool
}
