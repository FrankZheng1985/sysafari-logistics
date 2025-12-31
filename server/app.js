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
import { createServer } from 'http'

// 配置和工具
import { getDatabase, closeDatabase } from './config/database.js'
import { requestLogger, errorLogger } from './middleware/logger.js'
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler.js'
// 安全中间件
import { securityHeaders, rateLimit, loginRateLimit, xssProtection } from './middleware/security.js'

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
import chatRoutes from './modules/chat/routes.js'
import lastMileRoutes from './modules/last-mile/routes.js'
import quotationCenterRoutes from './modules/quotation-center/routes.js'
// 费用项审批模块
import feeItemApprovalRoutes from './modules/finance/feeItemApprovalRoutes.js'

// 新增：从 index.js 合并的路由
import clearanceRoutes from './modules/clearance/routes.js'
import taricRoutes from './modules/taric/routes.js'
import tariffRatesRoutes from './modules/tariff-rates/routes.js'
import cargoRoutes from './modules/cargo/routes.js'
import ocrRoutes from './modules/ocr/routes.js'
import trackingRoutes from './modules/tracking/routes.js'
import commissionRoutes from './modules/commission/routes.js'
import contractTemplateRoutes from './modules/contract-template/routes.js'
import dataImportRoutes from './modules/data-import/routes.js'
import helpVideoRoutes from './modules/help-video/routes.js'
import portalApiRoutes from './modules/portal-api/routes.js'
import openApiRoutes from './modules/open-api/routes.js'
import { initSocketServer } from './modules/chat/socket.js'

// 供应商模块初始化
import { initSupplierTable } from './modules/supplier/model.js'

// 帮助视频模块初始化
import { initHelpVideoTable } from './modules/help-video/model.js'

// 定时任务
import { startScheduler as startAlertScheduler } from './jobs/alertScheduler.js'
import { startBackupScheduler } from './jobs/backupScheduler.js'
import { startTaxValidationScheduler } from './modules/crm/taxScheduler.js'
import { startScheduler as startTaricScheduler } from './modules/taric/scheduler.js'

// 自动迁移脚本
import { runMigrations } from './scripts/auto-migrate.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 创建Express应用
const app = express()

// ==================== 中间件配置 ====================

// 安全响应头（最先执行）
app.use(securityHeaders())

// CORS配置（阿里云部署 - 已完全迁移）
app.use(cors({
  origin: [
    // 本地开发
    'http://localhost:5173', 
    'http://localhost:3000', 
    'http://localhost:3001', 
    'http://127.0.0.1:5173',
    // 客户门户本地开发
    'http://localhost:5174',
    'http://localhost:5175',
    // 阿里云生产环境
    'https://erp.xianfeng-eu.com',
    'https://www.erp.xianfeng-eu.com',
    'https://api.xianfeng-eu.com',
    // 阿里云客户门户
    'https://portal.xianfeng-eu.com',
    'https://customer.xianfeng-eu.com',
    // 阿里云 OSS 直接访问
    /\.oss-cn-hongkong\.aliyuncs\.com$/,
    // 演示环境
    'https://demo.xianfeng-eu.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-API-Key', 'X-API-Secret']
}))

// JSON解析
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// XSS防护
app.use(xssProtection())

// API速率限制（全局，每分钟100请求）
app.use('/api', rateLimit({ maxRequests: 100, windowMs: 60000 }))

// 登录接口更严格的速率限制
app.use('/api/auth/login', loginRateLimit())

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

// 费用项审批模块
app.use('/api/fee-item-approvals', feeItemApprovalRoutes)

// 文档管理模块
app.use('/api/documents', documentRoutes)

// 供应商管理模块
app.use('/api', supplierRoutes)

// 产品定价模块
app.use('/api', productRoutes)

// 消息/审批/预警模块
app.use('/api', messageRoutes)

// 聊天/业务讨论模块
app.use('/api/chat', chatRoutes)

// 最后里程模块
app.use('/api/last-mile', lastMileRoutes)

// 统一报价中心模块
app.use('/api/quotation-center', quotationCenterRoutes)

// 清关管理模块
app.use('/api', clearanceRoutes)

// TARIC海关编码模块
app.use('/api/taric', taricRoutes)

// 税率管理模块（前端使用的接口）
app.use('/api/tariff-rates', tariffRatesRoutes)

// 货物/商品管理模块
app.use('/api/cargo', cargoRoutes)

// OCR识别模块
app.use('/api/ocr', ocrRoutes)

// 物流跟踪模块
app.use('/api/tracking', trackingRoutes)

// 佣金管理模块
app.use('/api/commission', commissionRoutes)

// 合同模板模块
app.use('/api/contract-template', contractTemplateRoutes)

// 数据导入模块
app.use('/api/data-import', dataImportRoutes)

// 帮助视频模块
app.use('/api/help-videos', helpVideoRoutes)

// 客户门户 API 模块（供客户门户系统使用）
app.use('/api/portal', portalApiRoutes)

// 开放 API 模块（供客户 ERP/WMS 系统对接）
app.use('/open-api', openApiRoutes)

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
 * 初始化数据库和定时任务
 */
async function initializeDatabase() {
  const db = getDatabase()
  
  // 运行自动迁移
  try {
    await runMigrations()
    console.log('📦 数据库迁移检查完成')
  } catch (err) {
    console.error('⚠️ 数据库迁移出错:', err.message)
  }
  
  // 初始化供应商表
  initSupplierTable()
  
  // 初始化帮助视频表
  try {
    await initHelpVideoTable()
  } catch (err) {
    console.error('初始化帮助视频表失败:', err.message)
  }
  
  // 启动预警定时任务（每24小时检查一次）
  startAlertScheduler(24)
  
  // 启动备份定时任务
  startBackupScheduler().catch(err => {
    console.error('启动备份调度器失败:', err.message)
  })
  
  // 启动税号验证定时任务
  startTaxValidationScheduler()
  
  // 启动TARIC同步定时任务
  startTaricScheduler()
  
  console.log('📦 数据库和定时任务初始化完成')
  return db
}

// 创建HTTP服务器（用于Socket.io）
const httpServer = createServer(app)

// Socket.io实例
let io = null

/**
 * 启动服务器
 */
async function startServer() {
  // 初始化数据库
  await initializeDatabase()
  
  // 初始化Socket.io
  io = initSocketServer(httpServer)
  
  // 启动HTTP服务
  httpServer.listen(PORT, () => {
    console.log('')
    console.log('╔════════════════════════════════════════════════════════════╗')
    console.log('║                                                            ║')
    console.log('║   🚀 ERP物流管理系统 - 模块化架构 v2.0                      ║')
    console.log('║                                                            ║')
    console.log(`║   📡 服务地址: http://localhost:${PORT}                       ║`)
    console.log('║   📦 数据库: PostgreSQL                                    ║')
    console.log('║   🔌 WebSocket: Socket.io 已启用                           ║')
    console.log('║                                                            ║')
    console.log('║   📁 已加载模块 (20个):                                     ║')
    console.log('║   [基础数据] /api/countries, vat-rates, shipping-companies║')
    console.log('║   [订单管理] /api/bills, cmr/list, inspection/list        ║')
    console.log('║   [系统管理] /api/auth, users, roles, permissions         ║')
    console.log('║   [TMS运输] /api/cmr, service-providers                   ║')
    console.log('║   [CRM客户] /api/customers, follow-ups                    ║')
    console.log('║   [财务管理] /api/invoices, payments, fees                ║')
    console.log('║   [文档管理] /api/documents                                ║')
    console.log('║   [供应商管理] /api/suppliers                              ║')
    console.log('║   [消息中心] /api/messages, approvals, alerts             ║')
    console.log('║   [聊天中心] /api/chat (WebSocket)                         ║')
    console.log('║   [最后里程] /api/last-mile                                ║')
    console.log('║   [报价中心] /api/quotation-center                         ║')
    console.log('║   [清关管理] /api/clearance                                ║')
    console.log('║   [海关编码] /api/taric                                    ║')
    console.log('║   [货物管理] /api/cargo                                    ║')
    console.log('║   [OCR识别] /api/ocr                                       ║')
    console.log('║   [物流跟踪] /api/tracking                                 ║')
    console.log('║   [佣金管理] /api/commission                               ║')
    console.log('║   [合同模板] /api/contract-template                        ║')
    console.log('║                                                            ║')
    console.log('╚════════════════════════════════════════════════════════════╝')
    console.log('')
  })
  
  const server = httpServer
  
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

export { app, httpServer, io, startServer }
