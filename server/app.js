/**
 * ERP物流管理系统 - 主应用入口（模块化版本）
 * 
 * 模块化架构：
 * - config/     配置模块
 * - middleware/ 中间件
 * - utils/      工具函数
 * - modules/    业务模块
 *   - masterdata/ 基础数据
 *   - order/      订单管理
 *   - tms/        运输管理
 *   - finance/    财务管理
 *   - document/   文档管理
 *   - system/     系统管理
 *   - crm/        客户管理
 */

import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

// 配置和工具
import { getDatabase, closeDatabase } from './config/database.js'
import { requestLogger, errorLogger } from './middleware/logger.js'
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler.js'

// 业务模块路由
import masterdataRoutes from './modules/masterdata/routes.js'
import orderRoutes from './modules/order/routes.js'
import systemRoutes from './modules/system/routes.js'
import tmsRoutes from './modules/tms/routes.js'
import crmRoutes from './modules/crm/routes.js'
import financeRoutes from './modules/finance/routes.js'
import documentRoutes from './modules/document/routes.js'
import supplierRoutes from './modules/supplier/routes.js'
import productRoutes from './modules/product/routes.js'
import messageRoutes from './modules/message/routes.js'

// 供应商模块初始化
import { initSupplierTable } from './modules/supplier/model.js'

// 预警定时任务
import { startScheduler as startAlertScheduler } from './jobs/alertScheduler.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 创建Express应用
const app = express()

// ==================== 中间件配置 ====================

// CORS配置
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:5173'],
  credentials: true
}))

// JSON解析
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// 请求日志
app.use(requestLogger)

// 静态文件
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// ==================== API路由 ====================

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    errCode: 200,
    msg: 'OK',
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      architecture: 'modular-esm'
    }
  })
})

// 基础数据模块
app.use('/api', masterdataRoutes)

// 订单管理模块
app.use('/api', orderRoutes)

// 系统管理模块
app.use('/api', systemRoutes)

// TMS运输管理模块
app.use('/api', tmsRoutes)

// CRM客户关系管理模块
app.use('/api', crmRoutes)

// 财务管理模块
app.use('/api', financeRoutes)

// 文档管理模块
app.use('/api', documentRoutes)

// 供应商管理模块
app.use('/api', supplierRoutes)

// 产品定价模块
app.use('/api/product', productRoutes)

// 消息/审批/预警模块
app.use('/api', messageRoutes)

// ==================== 错误处理 ====================

// 错误日志
app.use(errorLogger)

// 404处理
app.use(notFoundHandler)

// 全局错误处理
app.use(globalErrorHandler)

// ==================== 服务器启动 ====================

const PORT = process.env.PORT || 3001  // 使用3001端口，避免与旧服务器冲突

/**
 * 初始化数据库
 */
function initializeDatabase() {
  const db = getDatabase()
  
  // 初始化供应商表
  initSupplierTable()
  
  // 启动预警定时任务（每24小时检查一次）
  startAlertScheduler(24)
  
  console.log('📦 数据库初始化完成')
  return db
}

/**
 * 启动服务器
 */
function startServer() {
  // 初始化数据库
  initializeDatabase()
  
  // 启动HTTP服务
  const server = app.listen(PORT, () => {
    console.log('')
    console.log('╔════════════════════════════════════════════════════════════╗')
    console.log('║                                                            ║')
    console.log('║   🚀 ERP物流管理系统 - 模块化架构 v2.0                      ║')
    console.log('║                                                            ║')
    console.log(`║   📡 服务地址: http://localhost:${PORT}                       ║`)
    console.log('║   📦 数据库: PostgreSQL                                    ║')
    console.log('║                                                            ║')
    console.log('║   📁 模块结构:                                             ║')
    console.log('║   [基础数据] /api/countries, vat-rates, shipping-companies║')
    console.log('║   [订单管理] /api/bills, cmr/list, inspection/list        ║')
    console.log('║   [系统管理] /api/auth, users, roles, permissions         ║')
    console.log('║   [TMS运输] /api/cmr, service-providers                   ║')
    console.log('║   [CRM客户] /api/customers, follow-ups                    ║')
    console.log('║   [财务管理] /api/invoices, payments, fees                ║')
    console.log('║   [文档管理]                                               ║')
    console.log('║      /api/documents          - 文档管理                    ║')
    console.log('║      /api/documents/:id/download - 文档下载                ║')
    console.log('║      /api/templates          - 文档模板                    ║')
    console.log('║   [供应商管理] /api/suppliers                              ║')
    console.log('║   [消息中心] /api/messages, approvals, alerts             ║')
    console.log('║                                                            ║')
    console.log('╚════════════════════════════════════════════════════════════╝')
    console.log('')
  })
  
  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n⏹️  正在关闭服务器...')
    server.close(() => {
      closeDatabase()
      console.log('✅ 服务器已安全关闭')
      process.exit(0)
    })
  })
  
  process.on('SIGTERM', () => {
    console.log('\n⏹️  收到终止信号...')
    server.close(() => {
      closeDatabase()
      process.exit(0)
    })
  })
}

// 如果直接运行此文件，则启动服务器
startServer()

export { app, startServer }
