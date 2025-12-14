/**
 * Node.js + Express + PostgreSQL 简单后端示例
 * 主入口文件
 */

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { pool, testConnection } from './config/database.js'

// 加载环境变量
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// ============ 中间件配置 ============
app.use(cors())                          // 启用跨域
app.use(express.json())                  // 解析JSON请求体
app.use(express.urlencoded({ extended: true }))  // 解析URL编码

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  next()
})

// ============ API 路由 ============

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: '服务运行正常',
    timestamp: new Date().toISOString()
  })
})

// 数据库连接测试
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time')
    res.json({
      status: 'ok',
      message: '数据库连接成功',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('数据库查询失败:', error)
    res.status(500).json({
      status: 'error',
      message: '数据库连接失败',
      error: error.message
    })
  }
})

// 示例：获取所有用户
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC')
    res.json({
      status: 'ok',
      data: result.rows,
      total: result.rowCount
    })
  } catch (error) {
    console.error('获取用户列表失败:', error)
    res.status(500).json({
      status: 'error',
      message: '获取用户列表失败',
      error: error.message
    })
  }
})

// 示例：创建用户
app.post('/api/users', async (req, res) => {
  const { name, email } = req.body

  // 简单参数验证
  if (!name || !email) {
    return res.status(400).json({
      status: 'error',
      message: '缺少必要参数: name 和 email'
    })
  }

  try {
    const result = await pool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    )
    res.status(201).json({
      status: 'ok',
      message: '用户创建成功',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('创建用户失败:', error)
    res.status(500).json({
      status: 'error',
      message: '创建用户失败',
      error: error.message
    })
  }
})

// 示例：根据ID获取用户
app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params

  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id])
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在'
      })
    }

    res.json({
      status: 'ok',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('获取用户失败:', error)
    res.status(500).json({
      status: 'error',
      message: '获取用户失败',
      error: error.message
    })
  }
})

// 示例：更新用户
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params
  const { name, email } = req.body

  try {
    const result = await pool.query(
      'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), updated_at = NOW() WHERE id = $3 RETURNING *',
      [name, email, id]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在'
      })
    }

    res.json({
      status: 'ok',
      message: '用户更新成功',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('更新用户失败:', error)
    res.status(500).json({
      status: 'error',
      message: '更新用户失败',
      error: error.message
    })
  }
})

// 示例：删除用户
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params

  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id])

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在'
      })
    }

    res.json({
      status: 'ok',
      message: '用户删除成功',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('删除用户失败:', error)
    res.status(500).json({
      status: 'error',
      message: '删除用户失败',
      error: error.message
    })
  }
})

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: '接口不存在'
  })
})

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err)
  res.status(500).json({
    status: 'error',
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

// ============ 启动服务器 ============
async function startServer() {
  try {
    // 测试数据库连接
    await testConnection()
    
    // 启动服务器
    app.listen(PORT, () => {
      console.log('========================================')
      console.log(`🚀 服务器已启动`)
      console.log(`📍 地址: http://localhost:${PORT}`)
      console.log(`🔧 环境: ${process.env.NODE_ENV || 'development'}`)
      console.log('========================================')
      console.log('可用接口:')
      console.log(`  GET  /api/health     - 健康检查`)
      console.log(`  GET  /api/db-test    - 数据库测试`)
      console.log(`  GET  /api/users      - 获取所有用户`)
      console.log(`  POST /api/users      - 创建用户`)
      console.log(`  GET  /api/users/:id  - 获取单个用户`)
      console.log(`  PUT  /api/users/:id  - 更新用户`)
      console.log(`  DELETE /api/users/:id - 删除用户`)
      console.log('========================================')
    })
  } catch (error) {
    console.error('❌ 服务器启动失败:', error)
    process.exit(1)
  }
}

startServer()
