import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'
import multer from 'multer'
import { readFileSync, existsSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import zlib from 'zlib'
import crypto from 'crypto'
import { createRequire } from 'module'
// 导入数据库配置模块
import { getDatabase, isUsingPostgres, testConnection } from './config/database.js'
// 导入模块路由
import clearanceRoutes from './modules/clearance/routes.js'
import crmRoutes from './modules/crm/routes.js'
import financeRoutes from './modules/finance/routes.js'
import masterdataRoutes from './modules/masterdata/routes.js'
import orderRoutes from './modules/order/routes.js'
import productRoutes from './modules/product/routes.js'
import supplierRoutes from './modules/supplier/routes.js'
import systemRoutes from './modules/system/routes.js'
import tmsRoutes from './modules/tms/routes.js'
// 导入税号自动验证定时任务
import { startTaxValidationScheduler } from './modules/crm/taxScheduler.js'
// 导入自动迁移脚本
import { runMigrations } from './scripts/auto-migrate.js'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')
const XLSX = require('xlsx')

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// 解码文件名（处理中文等非ASCII字符）
const decodeFileName = (filename) => {
  try {
    // 尝试从 latin1 解码为 UTF-8
    return Buffer.from(filename, 'latin1').toString('utf8')
  } catch (e) {
    return filename
  }
}

// 配置 multer 用于文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = join(__dirname, 'uploads')
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    // 使用唯一ID作为存储文件名，避免编码问题
    cb(null, `${file.fieldname}-${uniqueSuffix}`)
  }
})

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB (增加以支持Excel文件)
})

// 中间件
app.use(cors())
app.use(express.json({ limit: '50mb' }))  // 增加限制以支持营业执照OCR
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use('/uploads', express.static(join(__dirname, 'uploads')))

// 注册模块路由
app.use('/api', clearanceRoutes)
app.use('/api', crmRoutes)
app.use('/api', financeRoutes)
app.use('/api', masterdataRoutes)
app.use('/api', orderRoutes)
app.use('/api', productRoutes)
app.use('/api', supplierRoutes)
app.use('/api', systemRoutes)
app.use('/api', tmsRoutes)

// 数据库连接（PostgreSQL）
const USE_POSTGRES = isUsingPostgres()
// 统一使用 getDatabase() 获取数据库实例
const db = getDatabase()

// 初始化数据库表
function initDatabase() {
  // ==================== 序号序列管理表 ====================
  // 用于跟踪每个业务类型的当前序号，确保各业务独立编号
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_sequences (
      business_type TEXT PRIMARY KEY,
      current_seq INTEGER DEFAULT 0,
      prefix TEXT,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 初始化各业务类型的序号序列
  const businessTypes = [
    { type: 'package', prefix: 'PKG', description: '打包业务' },
    { type: 'bill', prefix: 'BP', description: '提单业务' },
    { type: 'draft', prefix: 'DFT', description: '草稿' },
    { type: 'declaration', prefix: 'DEC', description: '报关业务' },
    { type: 'label', prefix: 'LBL', description: '打单业务' },
    { type: 'last_mile', prefix: 'LM', description: '最后里程业务' },
  ]
  
  const initSeqStmt = db.prepare(`
    INSERT OR IGNORE INTO order_sequences (business_type, current_seq, prefix, description) 
    VALUES (?, 0, ?, ?)
  `)
  businessTypes.forEach(bt => {
    initSeqStmt.run(bt.type, bt.prefix, bt.description)
  })

  // ==================== 提单表 ====================
  db.exec(`
    CREATE TABLE IF NOT EXISTS bills_of_lading (
      id TEXT PRIMARY KEY,
      bill_id TEXT,
      bill_number TEXT NOT NULL,
      container_number TEXT,
      vessel TEXT,
      eta TEXT,
      ata TEXT,
      pieces INTEGER,
      weight REAL,
      volume REAL,
      inspection TEXT,
      customs_stats TEXT,
      creator TEXT,
      create_time TEXT,
      status TEXT,
      shipper TEXT,
      consignee TEXT,
      notify_party TEXT,
      port_of_loading TEXT,
      port_of_discharge TEXT,
      place_of_delivery TEXT,
      complete_time TEXT,
      delivery_status TEXT,
      transport_method TEXT,
      company_name TEXT,
      order_seq INTEGER,
      is_void INTEGER DEFAULT 0,
      void_reason TEXT,
      void_time TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 添加新列（如果表已存在但缺少这些列）
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN order_seq INTEGER`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN is_void INTEGER DEFAULT 0`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN void_reason TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN void_time TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN ship_status TEXT DEFAULT '船未到港'`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN skip_port TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN skip_port_time TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN customs_status TEXT DEFAULT '未放行'`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN customs_release_time TEXT`)
  } catch (e) { /* 列已存在 */ }
  // 换单字段
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN doc_swap_status TEXT DEFAULT '未换单'`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN doc_swap_time TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN actual_arrival_date TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN inspection_detail TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN inspection_estimated_time TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN inspection_start_time TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN inspection_end_time TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN inspection_result TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN inspection_result_note TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN inspection_release_time TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN inspection_confirmed_time TEXT`)
  } catch (e) { /* 列已存在 */ }

  // CMR/派送相关字段
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN cmr_detail TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN cmr_estimated_pickup_time TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN cmr_service_provider TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN cmr_delivery_address TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN cmr_estimated_arrival_time TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN cmr_actual_arrival_time TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN cmr_unloading_complete_time TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN cmr_confirmed_time TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN cmr_has_exception INTEGER DEFAULT 0`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN cmr_exception_note TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN cmr_exception_time TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN cmr_exception_status TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN cmr_exception_records TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN cmr_exception_resolution TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN cmr_exception_resolved_time TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN cmr_notes TEXT`)
  } catch (e) { /* 列已存在 */ }
  
  // 添加客户关联字段（CRM整合）
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN customer_id TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN customer_name TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN customer_code TEXT`)
  } catch (e) { /* 列已存在 */ }

  // 为现有提单数据分配序号（草稿和正式订单使用独立序号）
  // 检查是否需要重新分配序号（一次性迁移）
  const billSeqInfo = db.prepare(`SELECT current_seq FROM order_sequences WHERE business_type = 'bill'`).get()
  const draftSeqInfo = db.prepare(`SELECT current_seq FROM order_sequences WHERE business_type = 'draft'`).get()
  
  // 检测序号是否有间断（说明需要重新分配）
  const billCount = db.prepare(`SELECT COUNT(*) as count FROM bills_of_lading WHERE status != '草稿'`).get()?.count || 0
  const maxBillSeq = db.prepare(`SELECT MAX(order_seq) as max_seq FROM bills_of_lading WHERE status != '草稿'`).get()?.max_seq || 0
  
  if (maxBillSeq > billCount) {
    // 序号有间断，需要重新分配连续序号
    console.log(`[bill] 检测到序号间断（最大序号${maxBillSeq} > 订单数${billCount}），重新分配连续序号...`)
    
    // 获取所有正式订单，按创建时间排序
    const allBills = db.prepare(`SELECT id FROM bills_of_lading WHERE status != '草稿' ORDER BY create_time ASC, id ASC`).all()
    
    // 重新分配连续序号
    const updateStmt = db.prepare(`UPDATE bills_of_lading SET order_seq = ? WHERE id = ?`)
    let seq = 1
    for (const bill of allBills) {
      updateStmt.run(seq, bill.id)
      seq++
    }
    
    // 更新序列计数器
    db.prepare(`UPDATE order_sequences SET current_seq = ?, updated_at = CURRENT_TIMESTAMP WHERE business_type = 'bill'`)
      .run(allBills.length)
    
    console.log(`[bill] 已为 ${allBills.length} 条正式订单重新分配连续序号`)
  }
  
  // 检查草稿是否需要重新分配
  if (draftSeqInfo && draftSeqInfo.current_seq > 0) {
    const draftCount = db.prepare(`SELECT COUNT(*) as count FROM bills_of_lading WHERE status = '草稿'`).get()?.count || 0
    const maxDraftSeq = db.prepare(`SELECT MAX(order_seq) as max_seq FROM bills_of_lading WHERE status = '草稿'`).get()?.max_seq || 0
    
    if (maxDraftSeq > draftCount) {
      console.log(`[draft] 检测到序号间断，重新分配连续序号...`)
      db.prepare(`UPDATE bills_of_lading SET order_seq = NULL WHERE status = '草稿'`).run()
      db.prepare(`UPDATE order_sequences SET current_seq = 0 WHERE business_type = 'draft'`).run()
    }
  }
  
  // 为没有序号的记录分配序号
  // 1. 为草稿分配草稿序号（独立序号，从1开始）
  initializeSequenceForTableWithCondition('bills_of_lading', 'draft', "status = '草稿'")
  // 2. 为正式订单分配提单序号
  initializeSequenceForTableWithCondition('bills_of_lading', 'bill', "status != '草稿'")

  // ==================== 操作日志表 ====================
  db.exec(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      operation_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator TEXT DEFAULT 'system',
      operator_id TEXT,
      module TEXT DEFAULT 'order',
      remark TEXT,
      operation_time TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // 添加可能缺失的列（兼容旧数据库）
  try {
    db.exec(`ALTER TABLE operation_logs ADD COLUMN operator_id TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE operation_logs ADD COLUMN module TEXT DEFAULT 'order'`)
  } catch (e) { /* 列已存在 */ }
  
  // 创建索引
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_operation_logs_bill_id ON operation_logs(bill_id)`)
  } catch (e) { /* 索引已存在 */ }

  // ==================== 提单文件表 ====================
  db.exec(`
    CREATE TABLE IF NOT EXISTS bill_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      original_size INTEGER NOT NULL,
      compressed_size INTEGER NOT NULL,
      file_type TEXT NOT NULL,
      upload_by TEXT DEFAULT 'admin',
      upload_time TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // 创建索引
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bill_files_bill_id ON bill_files(bill_id)`)
  } catch (e) { /* 索引已存在 */ }

  // ==================== 作废申请表 ====================
  db.exec(`
    CREATE TABLE IF NOT EXISTS void_applications (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending_supervisor',
      applicant_id TEXT,
      applicant_name TEXT,
      supervisor_id TEXT,
      supervisor_name TEXT,
      supervisor_approved_at TEXT,
      supervisor_comment TEXT,
      finance_id TEXT,
      finance_name TEXT,
      finance_approved_at TEXT,
      finance_comment TEXT,
      fees_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // 创建索引
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_void_applications_bill_id ON void_applications(bill_id)`)
  } catch (e) { /* 索引已存在 */ }
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_void_applications_status ON void_applications(status)`)
  } catch (e) { /* 索引已存在 */ }

  // ==================== 系统配置表 ====================
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_configs (
      key TEXT PRIMARY KEY,
      value TEXT,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // 初始化默认配置
  try {
    db.prepare(`
      INSERT OR IGNORE INTO system_configs (key, value, description) VALUES 
      ('void_supervisor_id', '', '作废审批上级用户ID'),
      ('void_finance_id', '', '作废审批财务用户ID')
    `).run()
  } catch (e) { /* 配置已存在 */ }

  // 创建压缩文件存储目录
  const compressedDir = join(__dirname, 'uploads', 'compressed')
  if (!existsSync(compressedDir)) {
    mkdirSync(compressedDir, { recursive: true })
  }

  // ==================== 打包表 ====================
  db.exec(`
    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      package_id TEXT,
      package_number TEXT NOT NULL,
      bill_id TEXT,
      quantity INTEGER DEFAULT 1,
      weight REAL,
      volume REAL,
      dimensions TEXT,
      package_type TEXT,
      contents TEXT,
      creator TEXT,
      create_time TEXT,
      status TEXT DEFAULT '待处理',
      order_seq INTEGER,
      is_void INTEGER DEFAULT 0,
      void_reason TEXT,
      void_time TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // 添加新列
  try {
    db.exec(`ALTER TABLE packages ADD COLUMN order_seq INTEGER`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE packages ADD COLUMN is_void INTEGER DEFAULT 0`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE packages ADD COLUMN void_reason TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE packages ADD COLUMN void_time TEXT`)
  } catch (e) { /* 列已存在 */ }

  // 为现有打包数据分配序号
  initializeSequenceForTable('packages', 'package')

  // ==================== 报关表 ====================
  db.exec(`
    CREATE TABLE IF NOT EXISTS declarations (
      id TEXT PRIMARY KEY,
      declaration_id TEXT,
      declaration_number TEXT,
      bill_id TEXT,
      country TEXT,
      declaration_type TEXT,
      goods_description TEXT,
      hs_code TEXT,
      quantity INTEGER,
      value REAL,
      currency TEXT DEFAULT 'EUR',
      success_count INTEGER DEFAULT 0,
      producing_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      total_count INTEGER DEFAULT 0,
      priority TEXT,
      creator TEXT,
      create_time TEXT,
      status TEXT DEFAULT '待报关',
      order_seq INTEGER,
      is_void INTEGER DEFAULT 0,
      void_reason TEXT,
      void_time TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 添加新列
  try {
    db.exec(`ALTER TABLE declarations ADD COLUMN order_seq INTEGER`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE declarations ADD COLUMN is_void INTEGER DEFAULT 0`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE declarations ADD COLUMN void_reason TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE declarations ADD COLUMN void_time TEXT`)
  } catch (e) { /* 列已存在 */ }

  // 为现有报关数据分配序号
  initializeSequenceForTable('declarations', 'declaration')

  // ==================== 打单表（标签） ====================
  db.exec(`
    CREATE TABLE IF NOT EXISTS labels (
      id TEXT PRIMARY KEY,
      label_id TEXT,
      order_number TEXT NOT NULL,
      bill_id TEXT,
      transfer_method TEXT,
      label_type TEXT,
      recipient_name TEXT,
      recipient_address TEXT,
      recipient_phone TEXT,
      success_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      generating_count INTEGER DEFAULT 0,
      total_count INTEGER DEFAULT 0,
      creation_method TEXT,
      creator TEXT,
      create_time TEXT,
      status TEXT DEFAULT '待生成',
      order_seq INTEGER,
      is_void INTEGER DEFAULT 0,
      void_reason TEXT,
      void_time TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 添加新列
  try {
    db.exec(`ALTER TABLE labels ADD COLUMN order_seq INTEGER`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE labels ADD COLUMN is_void INTEGER DEFAULT 0`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE labels ADD COLUMN void_reason TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE labels ADD COLUMN void_time TEXT`)
  } catch (e) { /* 列已存在 */ }

  // 为现有打单数据分配序号
  initializeSequenceForTable('labels', 'label')

  // ==================== 最后里程表 ====================
  db.exec(`
    CREATE TABLE IF NOT EXISTS last_mile_orders (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      order_number TEXT NOT NULL,
      bill_id TEXT,
      bill_number TEXT,
      recipient_name TEXT,
      recipient_address TEXT,
      recipient_phone TEXT,
      delivery_company TEXT,
      tracking_number TEXT,
      estimated_delivery TEXT,
      actual_delivery TEXT,
      delivery_note TEXT,
      creator TEXT,
      create_time TEXT,
      status TEXT DEFAULT '待派送',
      order_seq INTEGER,
      is_void INTEGER DEFAULT 0,
      void_reason TEXT,
      void_time TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 添加新列
  try {
    db.exec(`ALTER TABLE last_mile_orders ADD COLUMN order_seq INTEGER`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE last_mile_orders ADD COLUMN is_void INTEGER DEFAULT 0`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE last_mile_orders ADD COLUMN void_reason TEXT`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE last_mile_orders ADD COLUMN void_time TEXT`)
  } catch (e) { /* 列已存在 */ }

  // 为现有最后里程数据分配序号
  initializeSequenceForTable('last_mile_orders', 'last_mile')

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_bill_number ON bills_of_lading(bill_number);
    CREATE INDEX IF NOT EXISTS idx_container_number ON bills_of_lading(container_number);
    CREATE INDEX IF NOT EXISTS idx_status ON bills_of_lading(status);
    CREATE INDEX IF NOT EXISTS idx_create_time ON bills_of_lading(create_time);
    CREATE INDEX IF NOT EXISTS idx_bill_order_seq ON bills_of_lading(order_seq);
    CREATE INDEX IF NOT EXISTS idx_bill_is_void ON bills_of_lading(is_void);
    
    CREATE INDEX IF NOT EXISTS idx_package_order_seq ON packages(order_seq);
    CREATE INDEX IF NOT EXISTS idx_package_is_void ON packages(is_void);
    
    CREATE INDEX IF NOT EXISTS idx_declaration_order_seq ON declarations(order_seq);
    CREATE INDEX IF NOT EXISTS idx_declaration_is_void ON declarations(is_void);
    
    CREATE INDEX IF NOT EXISTS idx_label_order_seq ON labels(order_seq);
    CREATE INDEX IF NOT EXISTS idx_label_is_void ON labels(is_void);
    
    CREATE INDEX IF NOT EXISTS idx_last_mile_order_seq ON last_mile_orders(order_seq);
    CREATE INDEX IF NOT EXISTS idx_last_mile_is_void ON last_mile_orders(is_void);
  `)

  // 基础数据表
  db.exec(`
    CREATE TABLE IF NOT EXISTS basic_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_basic_data_code ON basic_data(code);
    CREATE INDEX IF NOT EXISTS idx_basic_data_category ON basic_data(category);
    CREATE INDEX IF NOT EXISTS idx_basic_data_status ON basic_data(status);
  `)

  // 起运港表
  db.exec(`
    CREATE TABLE IF NOT EXISTS ports_of_loading (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      port_code TEXT NOT NULL UNIQUE,
      port_name_cn TEXT NOT NULL,
      port_name_en TEXT,
      country TEXT,
      country_code TEXT,
      city TEXT,
      description TEXT,
      transport_type TEXT DEFAULT 'sea',
      port_type TEXT DEFAULT 'main',
      parent_port_code TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // 为现有表添加 transport_type 字段（如果不存在）
  try {
    db.exec(`ALTER TABLE ports_of_loading ADD COLUMN transport_type TEXT DEFAULT 'sea'`)
  } catch (err) {
    // 字段已存在，忽略错误
  }

  // 为现有表添加 port_type 字段（如果不存在）
  try {
    db.exec(`ALTER TABLE ports_of_loading ADD COLUMN port_type TEXT DEFAULT 'main'`)
  } catch (err) {
    // 字段已存在，忽略错误
  }

  // 为现有表添加 parent_port_code 字段（如果不存在）
  try {
    db.exec(`ALTER TABLE ports_of_loading ADD COLUMN parent_port_code TEXT`)
  } catch (err) {
    // 字段已存在，忽略错误
  }

  // 为现有表添加 sort_order 字段（如果不存在）
  try {
    db.exec(`ALTER TABLE ports_of_loading ADD COLUMN sort_order INTEGER DEFAULT 0`)
  } catch (err) {
    // 字段已存在，忽略错误
  }

  // 将现有港口数据的 transport_type 更新为 'sea'（确保所有数据都是海运港类型）
  try {
    const updateResult = db.prepare(`UPDATE ports_of_loading SET transport_type = 'sea' WHERE transport_type IS NULL OR transport_type = '' OR transport_type != 'sea'`).run()
    if (updateResult.changes > 0) {
      console.log(`已将 ${updateResult.changes} 条港口数据更新为海运港类型`)
    }
  } catch (err) {
    // 忽略错误
    console.log('更新现有港口数据 transport_type 失败:', err)
  }

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ports_code ON ports_of_loading(port_code);
    CREATE INDEX IF NOT EXISTS idx_ports_name_cn ON ports_of_loading(port_name_cn);
    CREATE INDEX IF NOT EXISTS idx_ports_country ON ports_of_loading(country);
    CREATE INDEX IF NOT EXISTS idx_ports_status ON ports_of_loading(status);
  `)

  // 插入示例起运地数据
  const existingLoadingPorts = db.prepare('SELECT COUNT(*) as count FROM ports_of_loading').get()
  if (existingLoadingPorts.count === 0) {
    const insertLoadingPort = db.prepare(`
      INSERT INTO ports_of_loading (port_code, port_name_cn, port_name_en, country, country_code, city, transport_type, port_type) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    // 中国主要港口
    insertLoadingPort.run('CNSHA', '上海港', 'Shanghai', '中国', 'CN', '上海', 'sea', 'main')
    insertLoadingPort.run('CNNGB', '宁波港', 'Ningbo', '中国', 'CN', '宁波', 'sea', 'main')
    insertLoadingPort.run('CNSZX', '深圳港', 'Shenzhen', '中国', 'CN', '深圳', 'sea', 'main')
    insertLoadingPort.run('CNQIN', '青岛港', 'Qingdao', '中国', 'CN', '青岛', 'sea', 'main')
    insertLoadingPort.run('CNTXG', '天津港', 'Tianjin', '中国', 'CN', '天津', 'sea', 'main')
    insertLoadingPort.run('CNXMN', '厦门港', 'Xiamen', '中国', 'CN', '厦门', 'sea', 'main')
    insertLoadingPort.run('CNGZN', '广州港', 'Guangzhou', '中国', 'CN', '广州', 'sea', 'main')
    insertLoadingPort.run('CNDLC', '大连港', 'Dalian', '中国', 'CN', '大连', 'sea', 'main')
    // 空运港
    insertLoadingPort.run('CNPVG', '上海浦东机场', 'Shanghai Pudong', '中国', 'CN', '上海', 'air', 'main')
    insertLoadingPort.run('CNPEK', '北京首都机场', 'Beijing Capital', '中国', 'CN', '北京', 'air', 'main')
    insertLoadingPort.run('CNCAN', '广州白云机场', 'Guangzhou Baiyun', '中国', 'CN', '广州', 'air', 'main')
    console.log('已插入示例起运地数据')
  }

  // 目的港表
  db.exec(`
    CREATE TABLE IF NOT EXISTS destination_ports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      port_code TEXT NOT NULL UNIQUE,
      port_name_cn TEXT NOT NULL,
      port_name_en TEXT,
      country TEXT,
      country_code TEXT,
      city TEXT,
      transport_type TEXT DEFAULT 'sea',
      continent TEXT DEFAULT '亚洲',
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // 为现有目的港表添加新列
  try {
    db.exec(`ALTER TABLE destination_ports ADD COLUMN transport_type TEXT DEFAULT 'sea'`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE destination_ports ADD COLUMN continent TEXT DEFAULT '亚洲'`)
  } catch (e) { /* 列已存在 */ }

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dest_ports_code ON destination_ports(port_code);
    CREATE INDEX IF NOT EXISTS idx_dest_ports_name_cn ON destination_ports(port_name_cn);
    CREATE INDEX IF NOT EXISTS idx_dest_ports_country ON destination_ports(country);
    CREATE INDEX IF NOT EXISTS idx_dest_ports_status ON destination_ports(status);
    CREATE INDEX IF NOT EXISTS idx_dest_ports_transport_type ON destination_ports(transport_type);
    CREATE INDEX IF NOT EXISTS idx_dest_ports_continent ON destination_ports(continent);
  `)

  // 插入示例目的港数据
  const existingDestPorts = db.prepare('SELECT COUNT(*) as count FROM destination_ports').get()
  if (existingDestPorts.count === 0) {
    const insertDestPort = db.prepare(`
      INSERT INTO destination_ports (port_code, port_name_cn, port_name_en, country, country_code, city, transport_type, continent) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    // 欧洲港口
    insertDestPort.run('NLRTM', '鹿特丹港', 'Rotterdam', '荷兰', 'NL', '鹿特丹', 'sea', '欧洲')
    insertDestPort.run('DEHAM', '汉堡港', 'Hamburg', '德国', 'DE', '汉堡', 'sea', '欧洲')
    insertDestPort.run('BEANR', '安特卫普港', 'Antwerp', '比利时', 'BE', '安特卫普', 'sea', '欧洲')
    insertDestPort.run('GBFXT', '费利克斯托港', 'Felixstowe', '英国', 'GB', '费利克斯托', 'sea', '欧洲')
    insertDestPort.run('ESALG', '阿尔赫西拉斯港', 'Algeciras', '西班牙', 'ES', '阿尔赫西拉斯', 'sea', '欧洲')
    insertDestPort.run('ITGOA', '热那亚港', 'Genoa', '意大利', 'IT', '热那亚', 'sea', '欧洲')
    insertDestPort.run('FRLEH', '勒阿弗尔港', 'Le Havre', '法国', 'FR', '勒阿弗尔', 'sea', '欧洲')
    insertDestPort.run('PLGDN', '格但斯克港', 'Gdansk', '波兰', 'PL', '格但斯克', 'sea', '欧洲')
    // 北美港口
    insertDestPort.run('USLAX', '洛杉矶港', 'Los Angeles', '美国', 'US', '洛杉矶', 'sea', '北美洲')
    insertDestPort.run('USLGB', '长滩港', 'Long Beach', '美国', 'US', '长滩', 'sea', '北美洲')
    insertDestPort.run('USNYC', '纽约港', 'New York', '美国', 'US', '纽约', 'sea', '北美洲')
    insertDestPort.run('USSAV', '萨凡纳港', 'Savannah', '美国', 'US', '萨凡纳', 'sea', '北美洲')
    insertDestPort.run('CAHAL', '哈利法克斯港', 'Halifax', '加拿大', 'CA', '哈利法克斯', 'sea', '北美洲')
    insertDestPort.run('CAVAN', '温哥华港', 'Vancouver', '加拿大', 'CA', '温哥华', 'sea', '北美洲')
    // 亚洲港口
    insertDestPort.run('JPYOK', '横滨港', 'Yokohama', '日本', 'JP', '横滨', 'sea', '亚洲')
    insertDestPort.run('JPTYO', '东京港', 'Tokyo', '日本', 'JP', '东京', 'sea', '亚洲')
    insertDestPort.run('KRPUS', '釜山港', 'Busan', '韩国', 'KR', '釜山', 'sea', '亚洲')
    insertDestPort.run('SGSIN', '新加坡港', 'Singapore', '新加坡', 'SG', '新加坡', 'sea', '亚洲')
    insertDestPort.run('HKHKG', '香港港', 'Hong Kong', '中国香港', 'HK', '香港', 'sea', '亚洲')
    insertDestPort.run('VNSGN', '胡志明港', 'Ho Chi Minh', '越南', 'VN', '胡志明市', 'sea', '亚洲')
    // 大洋洲港口
    insertDestPort.run('AUSYD', '悉尼港', 'Sydney', '澳大利亚', 'AU', '悉尼', 'sea', '大洋洲')
    insertDestPort.run('AUMEL', '墨尔本港', 'Melbourne', '澳大利亚', 'AU', '墨尔本', 'sea', '大洋洲')
    console.log('已插入示例目的港数据')
  }

  // 空运港表
  db.exec(`
    CREATE TABLE IF NOT EXISTS air_ports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      port_code TEXT NOT NULL UNIQUE,
      port_name_cn TEXT NOT NULL,
      port_name_en TEXT,
      country TEXT,
      country_code TEXT,
      city TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_air_ports_code ON air_ports(port_code);
    CREATE INDEX IF NOT EXISTS idx_air_ports_name_cn ON air_ports(port_name_cn);
    CREATE INDEX IF NOT EXISTS idx_air_ports_country ON air_ports(country);
    CREATE INDEX IF NOT EXISTS idx_air_ports_status ON air_ports(status);
  `)

  // 插入示例空运港数据
  const existingAirPorts = db.prepare('SELECT COUNT(*) as count FROM air_ports').get()
  if (existingAirPorts.count === 0) {
    const insertAirPort = db.prepare(`
      INSERT INTO air_ports (port_code, port_name_cn, port_name_en, country, country_code, city) 
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    // 欧洲机场
    insertAirPort.run('FRA', '法兰克福机场', 'Frankfurt Airport', '德国', 'DE', '法兰克福')
    insertAirPort.run('AMS', '阿姆斯特丹机场', 'Amsterdam Schiphol', '荷兰', 'NL', '阿姆斯特丹')
    insertAirPort.run('LHR', '伦敦希思罗机场', 'London Heathrow', '英国', 'GB', '伦敦')
    insertAirPort.run('CDG', '巴黎戴高乐机场', 'Paris Charles de Gaulle', '法国', 'FR', '巴黎')
    insertAirPort.run('MXP', '米兰马尔彭萨机场', 'Milan Malpensa', '意大利', 'IT', '米兰')
    // 北美机场
    insertAirPort.run('JFK', '纽约肯尼迪机场', 'New York JFK', '美国', 'US', '纽约')
    insertAirPort.run('LAX', '洛杉矶机场', 'Los Angeles International', '美国', 'US', '洛杉矶')
    insertAirPort.run('ORD', '芝加哥奥黑尔机场', 'Chicago O\'Hare', '美国', 'US', '芝加哥')
    insertAirPort.run('YYZ', '多伦多皮尔逊机场', 'Toronto Pearson', '加拿大', 'CA', '多伦多')
    // 亚洲机场
    insertAirPort.run('NRT', '东京成田机场', 'Tokyo Narita', '日本', 'JP', '东京')
    insertAirPort.run('HND', '东京羽田机场', 'Tokyo Haneda', '日本', 'JP', '东京')
    insertAirPort.run('ICN', '首尔仁川机场', 'Seoul Incheon', '韩国', 'KR', '首尔')
    insertAirPort.run('SIN', '新加坡樟宜机场', 'Singapore Changi', '新加坡', 'SG', '新加坡')
    insertAirPort.run('HKG', '香港机场', 'Hong Kong International', '中国香港', 'HK', '香港')
    insertAirPort.run('BKK', '曼谷素万那普机场', 'Bangkok Suvarnabhumi', '泰国', 'TH', '曼谷')
    // 大洋洲机场
    insertAirPort.run('SYD', '悉尼机场', 'Sydney Airport', '澳大利亚', 'AU', '悉尼')
    insertAirPort.run('MEL', '墨尔本机场', 'Melbourne Airport', '澳大利亚', 'AU', '墨尔本')
    console.log('已插入示例空运港数据')
  }

  // 国家表
  db.exec(`
    CREATE TABLE IF NOT EXISTS countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_code TEXT NOT NULL UNIQUE,
      country_name_cn TEXT NOT NULL,
      country_name_en TEXT NOT NULL,
      continent TEXT,
      region TEXT,
      capital TEXT,
      currency_code TEXT,
      currency_name TEXT,
      phone_code TEXT,
      timezone TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_countries_code ON countries(country_code);
    CREATE INDEX IF NOT EXISTS idx_countries_name_cn ON countries(country_name_cn);
    CREATE INDEX IF NOT EXISTS idx_countries_name_en ON countries(country_name_en);
    CREATE INDEX IF NOT EXISTS idx_countries_continent ON countries(continent);
    CREATE INDEX IF NOT EXISTS idx_countries_status ON countries(status);
  `)

  // 插入示例国家数据
  const existingCountries = db.prepare('SELECT COUNT(*) as count FROM countries').get()
  if (existingCountries.count === 0) {
    const insertCountry = db.prepare(`
      INSERT INTO countries (country_code, country_name_cn, country_name_en, continent, currency_code, currency_name, phone_code) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    // 亚洲
    insertCountry.run('CN', '中国', 'China', '亚洲', 'CNY', '人民币', '+86')
    insertCountry.run('JP', '日本', 'Japan', '亚洲', 'JPY', '日元', '+81')
    insertCountry.run('KR', '韩国', 'South Korea', '亚洲', 'KRW', '韩元', '+82')
    insertCountry.run('SG', '新加坡', 'Singapore', '亚洲', 'SGD', '新加坡元', '+65')
    insertCountry.run('VN', '越南', 'Vietnam', '亚洲', 'VND', '越南盾', '+84')
    insertCountry.run('TH', '泰国', 'Thailand', '亚洲', 'THB', '泰铢', '+66')
    insertCountry.run('MY', '马来西亚', 'Malaysia', '亚洲', 'MYR', '林吉特', '+60')
    insertCountry.run('ID', '印度尼西亚', 'Indonesia', '亚洲', 'IDR', '印尼盾', '+62')
    insertCountry.run('PH', '菲律宾', 'Philippines', '亚洲', 'PHP', '菲律宾比索', '+63')
    insertCountry.run('IN', '印度', 'India', '亚洲', 'INR', '印度卢比', '+91')
    // 欧洲
    insertCountry.run('DE', '德国', 'Germany', '欧洲', 'EUR', '欧元', '+49')
    insertCountry.run('FR', '法国', 'France', '欧洲', 'EUR', '欧元', '+33')
    insertCountry.run('GB', '英国', 'United Kingdom', '欧洲', 'GBP', '英镑', '+44')
    insertCountry.run('IT', '意大利', 'Italy', '欧洲', 'EUR', '欧元', '+39')
    insertCountry.run('ES', '西班牙', 'Spain', '欧洲', 'EUR', '欧元', '+34')
    insertCountry.run('NL', '荷兰', 'Netherlands', '欧洲', 'EUR', '欧元', '+31')
    insertCountry.run('BE', '比利时', 'Belgium', '欧洲', 'EUR', '欧元', '+32')
    insertCountry.run('PL', '波兰', 'Poland', '欧洲', 'PLN', '兹罗提', '+48')
    insertCountry.run('SE', '瑞典', 'Sweden', '欧洲', 'SEK', '瑞典克朗', '+46')
    insertCountry.run('CH', '瑞士', 'Switzerland', '欧洲', 'CHF', '瑞士法郎', '+41')
    // 北美洲
    insertCountry.run('US', '美国', 'United States', '北美洲', 'USD', '美元', '+1')
    insertCountry.run('CA', '加拿大', 'Canada', '北美洲', 'CAD', '加元', '+1')
    insertCountry.run('MX', '墨西哥', 'Mexico', '北美洲', 'MXN', '墨西哥比索', '+52')
    // 南美洲
    insertCountry.run('BR', '巴西', 'Brazil', '南美洲', 'BRL', '雷亚尔', '+55')
    insertCountry.run('AR', '阿根廷', 'Argentina', '南美洲', 'ARS', '阿根廷比索', '+54')
    insertCountry.run('CL', '智利', 'Chile', '南美洲', 'CLP', '智利比索', '+56')
    // 大洋洲
    insertCountry.run('AU', '澳大利亚', 'Australia', '大洋洲', 'AUD', '澳元', '+61')
    insertCountry.run('NZ', '新西兰', 'New Zealand', '大洋洲', 'NZD', '新西兰元', '+64')
    // 非洲
    insertCountry.run('ZA', '南非', 'South Africa', '非洲', 'ZAR', '兰特', '+27')
    insertCountry.run('EG', '埃及', 'Egypt', '非洲', 'EGP', '埃及镑', '+20')
    console.log('已插入示例国家数据')
  }

  // 船公司表
  db.exec(`
    CREATE TABLE IF NOT EXISTS shipping_companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_code TEXT NOT NULL UNIQUE,
      company_name TEXT NOT NULL,
      country TEXT,
      website TEXT,
      contact_person TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      address TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建船公司索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_shipping_companies_code ON shipping_companies(company_code);
    CREATE INDEX IF NOT EXISTS idx_shipping_companies_name ON shipping_companies(company_name);
    CREATE INDEX IF NOT EXISTS idx_shipping_companies_status ON shipping_companies(status);
  `)

  // 插入示例船公司数据（全球主要船公司）
  const existingCompanies = db.prepare('SELECT COUNT(*) as count FROM shipping_companies').get()
  if (existingCompanies.count === 0) {
    const insertCompany = db.prepare(`
      INSERT INTO shipping_companies (company_code, company_name, country, website) VALUES (?, ?, ?, ?)
    `)
    
    // ==================== 全球TOP 20集装箱班轮公司 ====================
    // 1. 马士基 - 全球最大
    insertCompany.run('MAERSK', '马士基 Maersk', '丹麦', 'https://www.maersk.com')
    // 2. 地中海航运
    insertCompany.run('MSC', '地中海航运 MSC', '瑞士', 'https://www.msc.com')
    // 3. 达飞轮船
    insertCompany.run('CMA', '达飞轮船 CMA CGM', '法国', 'https://www.cma-cgm.com')
    // 4. 中远海运
    insertCompany.run('COSCO', '中远海运 COSCO', '中国', 'https://www.coscoshipping.com')
    // 5. 赫伯罗特
    insertCompany.run('HAPAG', '赫伯罗特 Hapag-Lloyd', '德国', 'https://www.hapag-lloyd.com')
    // 6. 海洋网联
    insertCompany.run('ONE', '海洋网联 ONE', '日本', 'https://www.one-line.com')
    // 7. 长荣海运
    insertCompany.run('EVERGREEN', '长荣海运 Evergreen', '中国台湾', 'https://www.evergreen-marine.com')
    // 8. 现代商船
    insertCompany.run('HMM', '现代商船 HMM', '韩国', 'https://www.hmm21.com')
    // 9. 阳明海运
    insertCompany.run('YANGMING', '阳明海运 Yang Ming', '中国台湾', 'https://www.yangming.com')
    // 10. 以星航运
    insertCompany.run('ZIM', '以星航运 ZIM', '以色列', 'https://www.zim.com')
    
    // ==================== 亚洲主要船公司 ====================
    // 万海航运
    insertCompany.run('WANHAI', '万海航运 Wan Hai', '中国台湾', 'https://www.wanhai.com')
    // 太平船务
    insertCompany.run('PIL', '太平船务 PIL', '新加坡', 'https://www.pilship.com')
    // 东方海外
    insertCompany.run('OOCL', '东方海外 OOCL', '中国香港', 'https://www.oocl.com')
    // 高丽海运
    insertCompany.run('KMTC', '高丽海运 KMTC', '韩国', 'https://www.kmtc.co.kr')
    // 海丰国际
    insertCompany.run('SITC', '海丰国际 SITC', '中国', 'https://www.sitc.com')
    // 长锦商船
    insertCompany.run('SINOKOR', '长锦商船 Sinokor', '韩国', 'https://www.sinokor.co.kr')
    // SM Line
    insertCompany.run('SMLINE', 'SM Line', '韩国', 'https://www.smlines.com')
    // 德翔航运
    insertCompany.run('TSLINES', '德翔航运 TS Lines', '中国台湾', 'https://www.tslines.com')
    // 中国外运
    insertCompany.run('SINOTRANS', '中国外运 Sinotrans', '中国', 'https://www.sinotrans.com')
    // 安通控股
    insertCompany.run('ANTONG', '安通控股 Antong', '中国', 'https://www.antong56.com')
    
    // ==================== 日本三大船公司（整合前） ====================
    // 日本邮船
    insertCompany.run('NYK', '日本邮船 NYK', '日本', 'https://www.nyk.com')
    // 商船三井
    insertCompany.run('MOL', '商船三井 MOL', '日本', 'https://www.mol.co.jp')
    // 川崎汽船
    insertCompany.run('KLINE', '川崎汽船 K Line', '日本', 'https://www.kline.co.jp')
    
    // ==================== 欧美主要船公司 ====================
    // 汉堡南美（被马士基收购）
    insertCompany.run('HAMBURGSUD', '汉堡南美 Hamburg Süd', '德国', 'https://www.hamburgsud.com')
    // 美国总统轮船（被达飞收购）
    insertCompany.run('APL', '美国总统轮船 APL', '新加坡', 'https://www.apl.com')
    // 赛弗斯
    insertCompany.run('SAFMARINE', 'Safmarine', '南非', 'https://www.safmarine.com')
    // 美森轮船
    insertCompany.run('MATSON', '美森轮船 Matson', '美国', 'https://www.matson.com')
    // Crowley
    insertCompany.run('CROWLEY', 'Crowley', '美国', 'https://www.crowley.com')
    
    // ==================== 中东及其他地区船公司 ====================
    // 阿拉伯联合航运（已合并到赫伯罗特）
    insertCompany.run('UASC', '阿拉伯联合航运 UASC', '阿联酋', 'https://www.uasc.net')
    // 伊朗国航
    insertCompany.run('IRISL', '伊朗国航 IRISL', '伊朗', 'https://www.irisl.net')
    // 土耳其航运
    insertCompany.run('TURKON', 'Turkon Line', '土耳其', 'https://www.turkon.com')
    // Arkas
    insertCompany.run('ARKAS', 'Arkas Line', '土耳其', 'https://www.arkasline.com.tr')
    
    // ==================== 新兴及区域船公司 ====================
    // SeaLead
    insertCompany.run('SEALEAD', 'SeaLead Shipping', '新加坡', 'https://www.sealead.com')
    // X-Press Feeders
    insertCompany.run('XPRESS', 'X-Press Feeders', '新加坡', 'https://www.x-pressfeeders.com')
    // Swire Shipping
    insertCompany.run('SWIRE', 'Swire Shipping', '中国香港', 'https://www.swireshipping.com')
    // 中谷海运
    insertCompany.run('ZHONGGU', '中谷海运 Zhonggu', '中国', 'https://www.zhonggushipping.com')
    // 泛亚航运
    insertCompany.run('PANASIA', '泛亚航运 Pan Asia', '中国', 'https://www.panasia-shipping.com')
    // 新海丰
    insertCompany.run('XINHAIFENG', '新海丰 Xinhaifeng', '中国', '')
    // 锦江航运
    insertCompany.run('JJSHIPPING', '锦江航运', '中国', 'https://www.jinjiangshipping.com')
    
    // ==================== 北欧及波罗的海船公司 ====================
    // Unifeeder
    insertCompany.run('UNIFEEDER', 'Unifeeder', '丹麦', 'https://www.unifeeder.com')
    // Containerships
    insertCompany.run('CONTAINERSHIPS', 'Containerships', '芬兰', 'https://www.containerships.eu')
    // Team Lines
    insertCompany.run('TEAMLINES', 'Team Lines', '德国', 'https://www.teamlines.de')
    // Samskip
    insertCompany.run('SAMSKIP', 'Samskip', '冰岛', 'https://www.samskip.com')
    
    // ==================== 地中海区域船公司 ====================
    // Grimaldi
    insertCompany.run('GRIMALDI', 'Grimaldi Lines', '意大利', 'https://www.grimaldi.napoli.it')
    // Messina
    insertCompany.run('MESSINA', 'Ignazio Messina', '意大利', 'https://www.messinaline.it')
    // Borchard Lines
    insertCompany.run('BORCHARD', 'Borchard Lines', '英国', 'https://www.borchard.net')
    
    // ==================== 拉丁美洲船公司 ====================
    // CSAV (已与赫伯罗特合并)
    insertCompany.run('CSAV', 'CSAV', '智利', 'https://www.csav.com')
    // Alianca (已被马士基收购)
    insertCompany.run('ALIANCA', 'Alianca', '巴西', 'https://www.alianca.com.br')
    // Log-In Logistica
    insertCompany.run('LOGIN', 'Log-In Logistica', '巴西', 'https://www.loginlogistica.com.br')
    
    // ==================== 非洲船公司 ====================
    // Delmas
    insertCompany.run('DELMAS', 'Delmas', '法国', 'https://www.delmas.com')
    // NileDutch
    insertCompany.run('NILEDUTCH', 'NileDutch', '荷兰', 'https://www.niledutch.com')
    
    // ==================== 澳洲及太平洋船公司 ====================
    // ANL (被达飞收购)
    insertCompany.run('ANL', 'ANL Container Line', '澳大利亚', 'https://www.anl.com.au')
    // Pacific International Lines
    insertCompany.run('PACIFICINT', 'Pacific International Lines', '新加坡', 'https://www.pilship.com')
    // Swire Pacific
    insertCompany.run('SWIREPACIFIC', 'Swire Pacific', '中国香港', 'https://www.swirepacific.com')
    
    // ==================== 印度次大陆船公司 ====================
    // Shipping Corporation of India
    insertCompany.run('SCI', 'Shipping Corporation of India', '印度', 'https://www.shipindia.com')
    // J M Baxi
    insertCompany.run('JMBAXI', 'J M Baxi', '印度', 'https://www.jmbaxi.com')
    // Transworld Group
    insertCompany.run('TRANSWORLD', 'Transworld Group', '印度', 'https://www.transworld.com')
    
    // ==================== 俄罗斯及独联体船公司 ====================
    // FESCO
    insertCompany.run('FESCO', 'FESCO', '俄罗斯', 'https://www.fesco.ru')
    // Sovcomflot
    insertCompany.run('SCF', 'Sovcomflot', '俄罗斯', 'https://www.scf-group.com')
    
    console.log('已插入全球主要船公司数据（60+家）')
  } else {
    // 补充缺失的船公司（数据迁移）
    const shippingCompaniesToAdd = [
      ['MAERSK', '马士基 Maersk', '丹麦', 'https://www.maersk.com'],
      ['MSC', '地中海航运 MSC', '瑞士', 'https://www.msc.com'],
      ['CMA', '达飞轮船 CMA CGM', '法国', 'https://www.cma-cgm.com'],
      ['COSCO', '中远海运 COSCO', '中国', 'https://www.coscoshipping.com'],
      ['HAPAG', '赫伯罗特 Hapag-Lloyd', '德国', 'https://www.hapag-lloyd.com'],
      ['ONE', '海洋网联 ONE', '日本', 'https://www.one-line.com'],
      ['EVERGREEN', '长荣海运 Evergreen', '中国台湾', 'https://www.evergreen-marine.com'],
      ['HMM', '现代商船 HMM', '韩国', 'https://www.hmm21.com'],
      ['YANGMING', '阳明海运 Yang Ming', '中国台湾', 'https://www.yangming.com'],
      ['ZIM', '以星航运 ZIM', '以色列', 'https://www.zim.com'],
      ['WANHAI', '万海航运 Wan Hai', '中国台湾', 'https://www.wanhai.com'],
      ['PIL', '太平船务 PIL', '新加坡', 'https://www.pilship.com'],
      ['OOCL', '东方海外 OOCL', '中国香港', 'https://www.oocl.com'],
      ['KMTC', '高丽海运 KMTC', '韩国', 'https://www.kmtc.co.kr'],
      ['SITC', '海丰国际 SITC', '中国', 'https://www.sitc.com'],
      ['SINOKOR', '长锦商船 Sinokor', '韩国', 'https://www.sinokor.co.kr'],
      ['SMLINE', 'SM Line', '韩国', 'https://www.smlines.com'],
      ['TSLINES', '德翔航运 TS Lines', '中国台湾', 'https://www.tslines.com'],
      ['SINOTRANS', '中国外运 Sinotrans', '中国', 'https://www.sinotrans.com'],
      ['ANTONG', '安通控股 Antong', '中国', 'https://www.antong56.com'],
      ['NYK', '日本邮船 NYK', '日本', 'https://www.nyk.com'],
      ['MOL', '商船三井 MOL', '日本', 'https://www.mol.co.jp'],
      ['KLINE', '川崎汽船 K Line', '日本', 'https://www.kline.co.jp'],
      ['HAMBURGSUD', '汉堡南美 Hamburg Süd', '德国', 'https://www.hamburgsud.com'],
      ['APL', '美国总统轮船 APL', '新加坡', 'https://www.apl.com'],
      ['SAFMARINE', 'Safmarine', '南非', 'https://www.safmarine.com'],
      ['MATSON', '美森轮船 Matson', '美国', 'https://www.matson.com'],
      ['CROWLEY', 'Crowley', '美国', 'https://www.crowley.com'],
      ['UASC', '阿拉伯联合航运 UASC', '阿联酋', 'https://www.uasc.net'],
      ['IRISL', '伊朗国航 IRISL', '伊朗', 'https://www.irisl.net'],
      ['TURKON', 'Turkon Line', '土耳其', 'https://www.turkon.com'],
      ['ARKAS', 'Arkas Line', '土耳其', 'https://www.arkasline.com.tr'],
      ['SEALEAD', 'SeaLead Shipping', '新加坡', 'https://www.sealead.com'],
      ['XPRESS', 'X-Press Feeders', '新加坡', 'https://www.x-pressfeeders.com'],
      ['SWIRE', 'Swire Shipping', '中国香港', 'https://www.swireshipping.com'],
      ['ZHONGGU', '中谷海运 Zhonggu', '中国', 'https://www.zhonggushipping.com'],
      ['PANASIA', '泛亚航运 Pan Asia', '中国', 'https://www.panasia-shipping.com'],
      ['XINHAIFENG', '新海丰 Xinhaifeng', '中国', ''],
      ['JJSHIPPING', '锦江航运', '中国', 'https://www.jinjiangshipping.com'],
      ['UNIFEEDER', 'Unifeeder', '丹麦', 'https://www.unifeeder.com'],
      ['CONTAINERSHIPS', 'Containerships', '芬兰', 'https://www.containerships.eu'],
      ['TEAMLINES', 'Team Lines', '德国', 'https://www.teamlines.de'],
      ['SAMSKIP', 'Samskip', '冰岛', 'https://www.samskip.com'],
      ['GRIMALDI', 'Grimaldi Lines', '意大利', 'https://www.grimaldi.napoli.it'],
      ['MESSINA', 'Ignazio Messina', '意大利', 'https://www.messinaline.it'],
      ['BORCHARD', 'Borchard Lines', '英国', 'https://www.borchard.net'],
      ['CSAV', 'CSAV', '智利', 'https://www.csav.com'],
      ['ALIANCA', 'Alianca', '巴西', 'https://www.alianca.com.br'],
      ['LOGIN', 'Log-In Logistica', '巴西', 'https://www.loginlogistica.com.br'],
      ['DELMAS', 'Delmas', '法国', 'https://www.delmas.com'],
      ['NILEDUTCH', 'NileDutch', '荷兰', 'https://www.niledutch.com'],
      ['ANL', 'ANL Container Line', '澳大利亚', 'https://www.anl.com.au'],
      ['SCI', 'Shipping Corporation of India', '印度', 'https://www.shipindia.com'],
      ['JMBAXI', 'J M Baxi', '印度', 'https://www.jmbaxi.com'],
      ['TRANSWORLD', 'Transworld Group', '印度', 'https://www.transworld.com'],
      ['FESCO', 'FESCO', '俄罗斯', 'https://www.fesco.ru'],
      ['SCF', 'Sovcomflot', '俄罗斯', 'https://www.scf-group.com'],
    ]
    
    const insertCompanyIfNotExists = db.prepare(`
      INSERT OR IGNORE INTO shipping_companies (company_code, company_name, country, website) VALUES (?, ?, ?, ?)
    `)
    
    let addedCount = 0
    shippingCompaniesToAdd.forEach(company => {
      const result = insertCompanyIfNotExists.run(...company)
      if (result.changes > 0) addedCount++
    })
    
    if (addedCount > 0) {
      console.log(`已补充 ${addedCount} 家船公司数据`)
    }
  }

  // 集装箱代码表
  db.exec(`
    CREATE TABLE IF NOT EXISTS container_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipping_company_id INTEGER NOT NULL,
      container_code TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shipping_company_id) REFERENCES shipping_companies(id)
    )
  `)

  // 创建集装箱代码索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_container_codes_code ON container_codes(container_code);
    CREATE INDEX IF NOT EXISTS idx_container_codes_company ON container_codes(shipping_company_id);
    CREATE INDEX IF NOT EXISTS idx_container_codes_status ON container_codes(status);
  `)

  // 插入示例集装箱代码数据（根据ISO 6346标准）
  const existingContainerCodes = db.prepare('SELECT COUNT(*) as count FROM container_codes').get()
  if (existingContainerCodes.count === 0) {
    const insertContainerCode = db.prepare(`
      INSERT INTO container_codes (shipping_company_id, container_code, description) VALUES (?, ?, ?)
    `)
    
    // 按船公司插入顺序对应（船公司按新顺序从1开始）
    // 1. MAERSK 马士基
    insertContainerCode.run(1, 'MSKU', '马士基集装箱 Maersk')
    insertContainerCode.run(1, 'MRKU', '马士基集装箱 Maersk')
    insertContainerCode.run(1, 'MAEU', '马士基集装箱 Maersk')
    insertContainerCode.run(1, 'MRSV', '马士基集装箱 Maersk')
    
    // 2. MSC 地中海航运
    insertContainerCode.run(2, 'MSCU', 'MSC集装箱')
    insertContainerCode.run(2, 'MEDU', 'MSC集装箱')
    insertContainerCode.run(2, 'SEGU', 'MSC集装箱')
    
    // 3. CMA 达飞轮船
    insertContainerCode.run(3, 'CMAU', '达飞集装箱 CMA CGM')
    insertContainerCode.run(3, 'CGMU', '达飞集装箱 CMA CGM')
    insertContainerCode.run(3, 'TEMU', '达飞集装箱 CMA CGM')
    
    // 4. COSCO 中远海运
    insertContainerCode.run(4, 'CCLU', '中远海运集装箱 COSCO')
    insertContainerCode.run(4, 'CBHU', '中远海运集装箱 COSCO')
    insertContainerCode.run(4, 'COSU', '中远海运集装箱 COSCO')
    insertContainerCode.run(4, 'CSQU', '中远海运集装箱 COSCO')
    
    // 5. HAPAG 赫伯罗特
    insertContainerCode.run(5, 'HLCU', '赫伯罗特集装箱 Hapag-Lloyd')
    insertContainerCode.run(5, 'HLXU', '赫伯罗特集装箱 Hapag-Lloyd')
    
    // 6. ONE 海洋网联
    insertContainerCode.run(6, 'ONEU', 'ONE集装箱')
    insertContainerCode.run(6, 'ONEY', 'ONE集装箱')
    
    // 7. EVERGREEN 长荣海运
    insertContainerCode.run(7, 'EGHU', '长荣集装箱 Evergreen')
    insertContainerCode.run(7, 'EISU', '长荣集装箱 Evergreen')
    insertContainerCode.run(7, 'EMCU', '长荣集装箱 Evergreen')
    insertContainerCode.run(7, 'EGSU', '长荣集装箱 Evergreen')
    
    // 8. HMM 现代商船
    insertContainerCode.run(8, 'HDMU', '现代商船集装箱 HMM')
    insertContainerCode.run(8, 'HMMU', '现代商船集装箱 HMM')
    
    // 9. YANGMING 阳明海运
    insertContainerCode.run(9, 'YMLU', '阳明集装箱 Yang Ming')
    insertContainerCode.run(9, 'YMMU', '阳明集装箱 Yang Ming')
    
    // 10. ZIM 以星航运
    insertContainerCode.run(10, 'ZIMU', '以星集装箱 ZIM')
    insertContainerCode.run(10, 'ZCSU', '以星集装箱 ZIM')
    
    // 11. WANHAI 万海航运
    insertContainerCode.run(11, 'WHLU', '万海集装箱 Wan Hai')
    insertContainerCode.run(11, 'WHSU', '万海集装箱 Wan Hai')
    
    // 12. PIL 太平船务
    insertContainerCode.run(12, 'PCIU', '太平船务集装箱 PIL')
    insertContainerCode.run(12, 'PILU', '太平船务集装箱 PIL')
    
    // 13. OOCL 东方海外
    insertContainerCode.run(13, 'OOLU', '东方海外集装箱 OOCL')
    insertContainerCode.run(13, 'OOCU', '东方海外集装箱 OOCL')
    
    // 14. KMTC 高丽海运
    insertContainerCode.run(14, 'KMTU', '高丽海运集装箱 KMTC')
    insertContainerCode.run(14, 'KMCU', '高丽海运集装箱 KMTC')
    
    // 15. SITC 海丰国际
    insertContainerCode.run(15, 'SITU', '海丰国际集装箱 SITC')
    
    // 16. SINOKOR 长锦商船
    insertContainerCode.run(16, 'SKHU', '长锦商船集装箱 Sinokor')
    
    // 17. SMLINE SM Line
    insertContainerCode.run(17, 'SMLM', 'SM Line集装箱')
    
    // 18. TSLINES 德翔航运
    insertContainerCode.run(18, 'TSLU', '德翔航运集装箱 TS Lines')
    
    // 19. SINOTRANS 中国外运
    insertContainerCode.run(19, 'SNTU', '中国外运集装箱 Sinotrans')
    
    // 20. ANTONG 安通控股
    insertContainerCode.run(20, 'ATHU', '安通控股集装箱 Antong')
    
    // 21. NYK 日本邮船
    insertContainerCode.run(21, 'NYKU', '日本邮船集装箱 NYK')
    
    // 22. MOL 商船三井
    insertContainerCode.run(22, 'MOLU', '商船三井集装箱 MOL')
    
    // 23. KLINE 川崎汽船
    insertContainerCode.run(23, 'KKFU', '川崎汽船集装箱 K Line')
    insertContainerCode.run(23, 'KKLU', '川崎汽船集装箱 K Line')
    
    // 24. HAMBURGSUD 汉堡南美
    insertContainerCode.run(24, 'SUDU', '汉堡南美集装箱 Hamburg Süd')
    
    // 25. APL 美国总统轮船
    insertContainerCode.run(25, 'APLU', 'APL集装箱')
    insertContainerCode.run(25, 'APHU', 'APL集装箱')
    
    // 26. SAFMARINE
    insertContainerCode.run(26, 'SAFM', 'Safmarine集装箱')
    
    // 27. MATSON 美森轮船
    insertContainerCode.run(27, 'MATU', '美森轮船集装箱 Matson')
    
    // 28. CROWLEY
    insertContainerCode.run(28, 'CLHU', 'Crowley集装箱')
    
    // 其他常见集装箱代码
    // TRITON 集装箱租赁
    insertContainerCode.run(null, 'TRLU', 'Triton租赁集装箱')
    insertContainerCode.run(null, 'TTNU', 'Triton租赁集装箱')
    // TEXTAINER 集装箱租赁
    insertContainerCode.run(null, 'TXGU', 'Textainer租赁集装箱')
    // SEACO 集装箱租赁
    insertContainerCode.run(null, 'SEAU', 'Seaco租赁集装箱')
    // BEACON 集装箱租赁
    insertContainerCode.run(null, 'BSIU', 'Beacon租赁集装箱')
    // CAI 集装箱租赁
    insertContainerCode.run(null, 'CXDU', 'CAI租赁集装箱')
    // FLORENS
    insertContainerCode.run(null, 'FCIU', 'Florens租赁集装箱')
    // TAL
    insertContainerCode.run(null, 'TALU', 'TAL租赁集装箱')
    // TOUAX
    insertContainerCode.run(null, 'TGHU', 'Touax租赁集装箱')
    // UES
    insertContainerCode.run(null, 'UESU', 'UES租赁集装箱')
    
    console.log('已插入全球主要船公司集装箱代码数据')
  } else {
    // 补充缺失的集装箱代码（数据迁移）
    // 获取船公司ID映射
    const companies = db.prepare('SELECT id, company_code FROM shipping_companies').all()
    const companyMap = {}
    companies.forEach(c => { companyMap[c.company_code] = c.id })
    
    const containerCodesToAdd = [
      // 马士基 MAERSK
      ['MAERSK', 'MSKU', '马士基集装箱 Maersk'],
      ['MAERSK', 'MRKU', '马士基集装箱 Maersk'],
      ['MAERSK', 'MAEU', '马士基集装箱 Maersk'],
      ['MAERSK', 'MRSV', '马士基集装箱 Maersk'],
      ['MAERSK', 'MCPU', '马士基集装箱 Maersk'],
      // 地中海航运 MSC
      ['MSC', 'MSCU', 'MSC集装箱'],
      ['MSC', 'MEDU', 'MSC集装箱'],
      ['MSC', 'SEGU', 'MSC集装箱'],
      ['MSC', 'MSMU', 'MSC集装箱'],
      // 达飞轮船 CMA CGM
      ['CMA', 'CMAU', '达飞集装箱 CMA CGM'],
      ['CMA', 'CGMU', '达飞集装箱 CMA CGM'],
      ['CMA', 'TEMU', '达飞集装箱 CMA CGM'],
      ['CMA', 'TCKU', '达飞集装箱 CMA CGM'],
      ['CMA', 'TCLU', '达飞集装箱 CMA CGM'],
      // 中远海运 COSCO
      ['COSCO', 'CCLU', '中远海运集装箱 COSCO'],
      ['COSCO', 'CBHU', '中远海运集装箱 COSCO'],
      ['COSCO', 'COSU', '中远海运集装箱 COSCO'],
      ['COSCO', 'CSQU', '中远海运集装箱 COSCO'],
      ['COSCO', 'CSNU', '中远海运集装箱 COSCO'],
      ['COSCO', 'CCTU', '中远海运集装箱 COSCO'],
      // 赫伯罗特 Hapag-Lloyd
      ['HAPAG', 'HLCU', '赫伯罗特集装箱 Hapag-Lloyd'],
      ['HAPAG', 'HLXU', '赫伯罗特集装箱 Hapag-Lloyd'],
      ['HAPAG', 'HPLU', '赫伯罗特集装箱 Hapag-Lloyd'],
      // 海洋网联 ONE
      ['ONE', 'ONEU', 'ONE集装箱'],
      ['ONE', 'ONEY', 'ONE集装箱'],
      ['ONE', 'TCNU', 'ONE集装箱'],
      // 长荣海运 Evergreen
      ['EVERGREEN', 'EGHU', '长荣集装箱 Evergreen'],
      ['EVERGREEN', 'EISU', '长荣集装箱 Evergreen'],
      ['EVERGREEN', 'EMCU', '长荣集装箱 Evergreen'],
      ['EVERGREEN', 'EGSU', '长荣集装箱 Evergreen'],
      ['EVERGREEN', 'EITU', '长荣集装箱 Evergreen'],
      // 现代商船 HMM
      ['HMM', 'HDMU', '现代商船集装箱 HMM'],
      ['HMM', 'HMMU', '现代商船集装箱 HMM'],
      ['HMM', 'HMCU', '现代商船集装箱 HMM'],
      // 阳明海运 Yang Ming
      ['YANGMING', 'YMLU', '阳明集装箱 Yang Ming'],
      ['YANGMING', 'YMMU', '阳明集装箱 Yang Ming'],
      ['YANGMING', 'YMLM', '阳明集装箱 Yang Ming'],
      // 以星航运 ZIM
      ['ZIM', 'ZIMU', '以星集装箱 ZIM'],
      ['ZIM', 'ZCSU', '以星集装箱 ZIM'],
      ['ZIM', 'SZLU', '以星集装箱 ZIM'],
      // 万海航运 Wan Hai
      ['WANHAI', 'WHLU', '万海集装箱 Wan Hai'],
      ['WANHAI', 'WHSU', '万海集装箱 Wan Hai'],
      // 太平船务 PIL
      ['PIL', 'PCIU', '太平船务集装箱 PIL'],
      ['PIL', 'PILU', '太平船务集装箱 PIL'],
      // 东方海外 OOCL
      ['OOCL', 'OOLU', '东方海外集装箱 OOCL'],
      ['OOCL', 'OOCU', '东方海外集装箱 OOCL'],
      // 高丽海运 KMTC
      ['KMTC', 'KMTU', '高丽海运集装箱 KMTC'],
      ['KMTC', 'KMCU', '高丽海运集装箱 KMTC'],
      // 海丰国际 SITC
      ['SITC', 'SITU', '海丰国际集装箱 SITC'],
      ['SITC', 'STCU', '海丰国际集装箱 SITC'],
      // 长锦商船 Sinokor
      ['SINOKOR', 'SKHU', '长锦商船集装箱 Sinokor'],
      ['SINOKOR', 'SNKU', '长锦商船集装箱 Sinokor'],
      // SM Line
      ['SMLINE', 'SMLM', 'SM Line集装箱'],
      // 德翔航运 TS Lines
      ['TSLINES', 'TSLU', '德翔航运集装箱 TS Lines'],
      // 中国外运 Sinotrans
      ['SINOTRANS', 'SNTU', '中国外运集装箱 Sinotrans'],
      // 安通控股 Antong
      ['ANTONG', 'ATHU', '安通控股集装箱 Antong'],
      // 日本邮船 NYK
      ['NYK', 'NYKU', '日本邮船集装箱 NYK'],
      ['NYK', 'NKYU', '日本邮船集装箱 NYK'],
      // 商船三井 MOL
      ['MOL', 'MOLU', '商船三井集装箱 MOL'],
      ['MOL', 'MOIU', '商船三井集装箱 MOL'],
      // 川崎汽船 K Line
      ['KLINE', 'KKFU', '川崎汽船集装箱 K Line'],
      ['KLINE', 'KKLU', '川崎汽船集装箱 K Line'],
      // 汉堡南美 Hamburg Süd
      ['HAMBURGSUD', 'SUDU', '汉堡南美集装箱 Hamburg Süd'],
      ['HAMBURGSUD', 'HDSU', '汉堡南美集装箱 Hamburg Süd'],
      // 美国总统轮船 APL
      ['APL', 'APLU', 'APL集装箱'],
      ['APL', 'APHU', 'APL集装箱'],
      ['APL', 'APZU', 'APL集装箱'],
      // Safmarine
      ['SAFMARINE', 'SAFM', 'Safmarine集装箱'],
      ['SAFMARINE', 'SFAU', 'Safmarine集装箱'],
      // 美森轮船 Matson
      ['MATSON', 'MATU', '美森轮船集装箱 Matson'],
      ['MATSON', 'MASU', '美森轮船集装箱 Matson'],
      // Crowley
      ['CROWLEY', 'CLHU', 'Crowley集装箱'],
      ['CROWLEY', 'CRSU', 'Crowley集装箱'],
      // X-Press Feeders
      ['XPRESS', 'XPRU', 'X-Press Feeders集装箱'],
      // ANL
      ['ANL', 'ANLU', 'ANL集装箱'],
      // CSAV
      ['CSAV', 'CSVU', 'CSAV集装箱'],
      // Alianca
      ['ALIANCA', 'ALCU', 'Alianca集装箱'],
      // FESCO
      ['FESCO', 'FESU', 'FESCO集装箱'],
      // Turkon
      ['TURKON', 'TKLU', 'Turkon集装箱'],
      // Arkas
      ['ARKAS', 'ARKU', 'Arkas集装箱'],
      // Grimaldi
      ['GRIMALDI', 'GRMU', 'Grimaldi集装箱'],
      // Unifeeder
      ['UNIFEEDER', 'UFEU', 'Unifeeder集装箱'],
      // 中谷海运
      ['ZHONGGU', 'ZGHU', '中谷海运集装箱'],
      // 泛亚航运
      ['PANASIA', 'PASU', '泛亚航运集装箱'],
      // 锦江航运
      ['JJSHIPPING', 'JJSU', '锦江航运集装箱'],
    ]
    
    // 集装箱租赁公司代码（无需关联船公司）
    const leasingCodesToAdd = [
      ['TRLU', 'Triton租赁集装箱'],
      ['TTNU', 'Triton租赁集装箱'],
      ['TXGU', 'Textainer租赁集装箱'],
      ['TGCU', 'Textainer租赁集装箱'],
      ['SEAU', 'Seaco租赁集装箱'],
      ['BSIU', 'Beacon租赁集装箱'],
      ['CXDU', 'CAI租赁集装箱'],
      ['FCIU', 'Florens租赁集装箱'],
      ['TALU', 'TAL租赁集装箱'],
      ['TGHU', 'Touax租赁集装箱'],
      ['UESU', 'UES租赁集装箱'],
      ['CRXU', 'Cronos租赁集装箱'],
      ['GLDU', 'Gold Container租赁集装箱'],
      ['GCNU', 'GE Capital租赁集装箱'],
      ['ILCU', 'Interpool租赁集装箱'],
      ['CRSU', 'Crowley租赁集装箱'],
      ['DFSU', 'Dong Fang租赁集装箱'],
      ['DRYU', 'Drytainer租赁集装箱'],
      ['GESU', 'GE Seaco租赁集装箱'],
      ['HASU', 'Hapag租赁集装箱'],
      ['INBU', 'Interbox租赁集装箱'],
      ['IPXU', 'Interpool Express租赁集装箱'],
      ['ITCU', 'Intercontainer租赁集装箱'],
      ['PCVU', 'Pacific Lease租赁集装箱'],
      ['PRGU', 'Progress租赁集装箱'],
      ['PVDU', 'Provider租赁集装箱'],
      ['SCZU', 'SeaCube租赁集装箱'],
      ['SMCU', 'SeaCube租赁集装箱'],
      ['TBJU', 'TaiBox租赁集装箱'],
      ['TCCU', 'TCC租赁集装箱'],
      ['TDRU', 'Transamerica租赁集装箱'],
      ['TRIU', 'Trans-Ireland租赁集装箱'],
      ['UBCU', 'UBC租赁集装箱'],
      ['XINU', 'Xines租赁集装箱'],
    ]
    
    const insertCodeIfNotExists = db.prepare(`
      INSERT OR IGNORE INTO container_codes (shipping_company_id, container_code, description) VALUES (?, ?, ?)
    `)
    
    let addedCount = 0
    
    // 添加船公司集装箱代码
    containerCodesToAdd.forEach(([companyCode, containerCode, description]) => {
      const companyId = companyMap[companyCode] || null
      const result = insertCodeIfNotExists.run(companyId, containerCode, description)
      if (result.changes > 0) addedCount++
    })
    
    // 添加租赁公司集装箱代码
    leasingCodesToAdd.forEach(([containerCode, description]) => {
      const result = insertCodeIfNotExists.run(null, containerCode, description)
      if (result.changes > 0) addedCount++
    })
    
    if (addedCount > 0) {
      console.log(`已补充 ${addedCount} 个集装箱代码`)
    }
  }

  // 服务商表（TMS模块）
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_code TEXT NOT NULL UNIQUE,
      provider_name TEXT NOT NULL,
      service_type TEXT DEFAULT 'delivery',
      contact_person TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      address TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建服务商索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_service_providers_code ON service_providers(provider_code);
    CREATE INDEX IF NOT EXISTS idx_service_providers_name ON service_providers(provider_name);
    CREATE INDEX IF NOT EXISTS idx_service_providers_type ON service_providers(service_type);
    CREATE INDEX IF NOT EXISTS idx_service_providers_status ON service_providers(status);
  `)

  // 插入示例服务商数据
  const existingProviders = db.prepare('SELECT COUNT(*) as count FROM service_providers').get()
  if (existingProviders.count === 0) {
    const insertProvider = db.prepare(`
      INSERT INTO service_providers (provider_code, provider_name, service_type, contact_person, contact_phone, contact_email, address, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    // 派送服务商
    insertProvider.run('SP001', 'DHL快递', 'delivery', '张经理', '021-12345678', 'contact@dhl.com', '上海市浦东新区', 'active')
    insertProvider.run('SP002', 'UPS物流', 'delivery', '李经理', '020-87654321', 'contact@ups.com', '广州市天河区', 'active')
    insertProvider.run('SP003', 'FedEx联邦快递', 'delivery', '王经理', '010-11111111', 'contact@fedex.com', '北京市朝阳区', 'active')
    insertProvider.run('SP004', '顺丰速运', 'delivery', '陈经理', '0755-22222222', 'contact@sf.com', '深圳市南山区', 'active')
    insertProvider.run('SP005', '中通快递', 'delivery', '赵经理', '0571-33333333', 'contact@zto.com', '杭州市西湖区', 'active')
    // 仓储服务商
    insertProvider.run('WH001', '远洋仓储', 'warehouse', '刘经理', '021-44444444', 'contact@ocean-wh.com', '上海市嘉定区', 'active')
    insertProvider.run('WH002', '港通仓储', 'warehouse', '周经理', '0574-55555555', 'contact@gangton.com', '宁波市北仑区', 'active')
    // 报关服务商
    insertProvider.run('CB001', '华信报关', 'customs', '吴经理', '021-66666666', 'contact@huaxin-cb.com', '上海市浦东新区', 'active')
    insertProvider.run('CB002', '环球报关', 'customs', '郑经理', '0755-77777777', 'contact@global-cb.com', '深圳市福田区', 'active')
    // 拖车服务商
    insertProvider.run('TK001', '港顺拖车', 'trucking', '孙经理', '021-88888888', 'contact@gangshun.com', '上海市宝山区', 'active')
    insertProvider.run('TK002', '安达拖车', 'trucking', '杨经理', '0574-99999999', 'contact@anda-tk.com', '宁波市镇海区', 'active')
    console.log('已插入示例服务商数据')
  }

  // 运费价格表（TMS模块）
  db.exec(`
    CREATE TABLE IF NOT EXISTS transport_pricing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_code TEXT NOT NULL UNIQUE,
      route_name TEXT NOT NULL,
      origin TEXT,
      destination TEXT,
      service_type TEXT DEFAULT 'delivery',
      price_type TEXT DEFAULT 'per_kg',
      unit_price REAL DEFAULT 0,
      currency TEXT DEFAULT 'EUR',
      min_weight REAL DEFAULT 0,
      max_weight REAL DEFAULT 0,
      effective_date DATE,
      expiry_date DATE,
      provider_id INTEGER,
      provider_name TEXT,
      status TEXT DEFAULT 'active',
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建运费价格索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transport_pricing_code ON transport_pricing(route_code);
    CREATE INDEX IF NOT EXISTS idx_transport_pricing_type ON transport_pricing(service_type);
    CREATE INDEX IF NOT EXISTS idx_transport_pricing_status ON transport_pricing(status);
  `)

  // 插入示例运费数据
  const existingPricing = db.prepare('SELECT COUNT(*) as count FROM transport_pricing').get()
  if (existingPricing.count === 0) {
    const insertPricing = db.prepare(`
      INSERT INTO transport_pricing (route_code, route_name, origin, destination, service_type, price_type, unit_price, currency, min_weight, max_weight, effective_date, expiry_date, provider_id, provider_name, status, remark) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    insertPricing.run('RT001', '上海-鹿特丹派送', '上海', '鹿特丹', 'delivery', 'per_kg', 12.5, 'EUR', 0, 1000, '2024-01-01', '2024-12-31', 1, 'DHL快递', 'active', '含基本保险')
    insertPricing.run('RT002', '宁波-汉堡派送', '宁波', '汉堡', 'delivery', 'per_kg', 15.0, 'EUR', 0, 500, '2024-01-01', '2024-12-31', 2, 'UPS物流', 'active', '')
    insertPricing.run('RT003', '深圳-伦敦整柜', '深圳', '伦敦', 'fcl', 'per_container', 2800, 'EUR', 0, 0, '2024-01-01', '2024-12-31', null, 'MSC海运', 'active', '40尺柜')
    insertPricing.run('RT004', '上海-纽约空运', '上海', '纽约', 'air', 'per_kg', 35.0, 'EUR', 0, 0, '2024-01-01', '2024-12-31', 3, 'FedEx联邦快递', 'active', '')
    insertPricing.run('RT005', '广州-新加坡拼箱', '广州', '新加坡', 'lcl', 'per_cbm', 450, 'EUR', 0, 0, '2024-01-01', '2024-12-31', null, '', 'active', '')
    console.log('已插入示例运费数据')
  }

  // 服务费类别表
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_fee_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_fee_categories_code ON service_fee_categories(code);
    CREATE INDEX IF NOT EXISTS idx_fee_categories_status ON service_fee_categories(status);
  `)

  // 插入默认服务费类别
  const existingCategories = db.prepare('SELECT COUNT(*) as count FROM service_fee_categories').get()
  if (existingCategories.count === 0) {
    const insertCategory = db.prepare(`
      INSERT INTO service_fee_categories (name, code, description, sort_order, status)
      VALUES (?, ?, ?, ?, 'active')
    `)
    insertCategory.run('报关服务', 'CUSTOMS', '报关相关服务费用', 1)
    insertCategory.run('仓储服务', 'WAREHOUSE', '仓储相关服务费用', 2)
    insertCategory.run('运输服务', 'TRANSPORT', '运输相关服务费用', 3)
    insertCategory.run('其他服务', 'OTHER', '其他服务费用', 4)
    console.log('已插入默认服务费类别')
  }

  // 运输方式表
  db.exec(`
    CREATE TABLE IF NOT EXISTS transport_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      icon TEXT,
      sort_order INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建运输方式索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transport_methods_code ON transport_methods(code);
    CREATE INDEX IF NOT EXISTS idx_transport_methods_status ON transport_methods(status);
  `)

  // 插入默认运输方式
  const existingTransportMethods = db.prepare('SELECT COUNT(*) as count FROM transport_methods').get()
  if (existingTransportMethods.count === 0) {
    const insertTransportMethod = db.prepare(`
      INSERT INTO transport_methods (name, code, description, icon, sort_order, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `)
    insertTransportMethod.run('卡车', 'TRUCK', '公路卡车运输', 'truck', 1)
    insertTransportMethod.run('空运', 'AIR', '航空运输', 'plane', 2)
    insertTransportMethod.run('海运', 'SEA', '海洋运输', 'ship', 3)
    insertTransportMethod.run('铁路', 'RAIL', '铁路运输', 'train', 4)
    insertTransportMethod.run('快递', 'EXPRESS', '快递服务', 'package', 5)
    console.log('已插入默认运输方式')
  }

  // 增值税率表
  db.exec(`
    CREATE TABLE IF NOT EXISTS vat_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_code TEXT NOT NULL,
      country_name TEXT NOT NULL,
      standard_rate REAL NOT NULL DEFAULT 19,
      reduced_rate REAL DEFAULT 0,
      super_reduced_rate REAL DEFAULT 0,
      parking_rate REAL DEFAULT 0,
      description TEXT,
      effective_date TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vat_rates_country_code ON vat_rates(country_code);
    CREATE INDEX IF NOT EXISTS idx_vat_rates_status ON vat_rates(status);
  `)

  // 插入默认增值税率数据
  const existingVatRates = db.prepare('SELECT COUNT(*) as count FROM vat_rates').get()
  if (existingVatRates.count === 0) {
    const insertVatRate = db.prepare(`
      INSERT INTO vat_rates (country_code, country_name, standard_rate, reduced_rate, description, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `)
    insertVatRate.run('DE', '德国', 19, 7, '德国标准增值税率19%，优惠税率7%')
    insertVatRate.run('FR', '法国', 20, 10, '法国标准增值税率20%，优惠税率10%')
    insertVatRate.run('GB', '英国', 20, 5, '英国标准增值税率20%，优惠税率5%')
    insertVatRate.run('IT', '意大利', 22, 10, '意大利标准增值税率22%，优惠税率10%')
    insertVatRate.run('ES', '西班牙', 21, 10, '西班牙标准增值税率21%，优惠税率10%')
    insertVatRate.run('NL', '荷兰', 21, 9, '荷兰标准增值税率21%，优惠税率9%')
    insertVatRate.run('BE', '比利时', 21, 12, '比利时标准增值税率21%，优惠税率12%')
    insertVatRate.run('PL', '波兰', 23, 8, '波兰标准增值税率23%，优惠税率8%')
    insertVatRate.run('AT', '奥地利', 20, 10, '奥地利标准增值税率20%，优惠税率10%')
    insertVatRate.run('SE', '瑞典', 25, 12, '瑞典标准增值税率25%，优惠税率12%')
    insertVatRate.run('DK', '丹麦', 25, 0, '丹麦标准增值税率25%')
    insertVatRate.run('FI', '芬兰', 24, 14, '芬兰标准增值税率24%，优惠税率14%')
    insertVatRate.run('PT', '葡萄牙', 23, 13, '葡萄牙标准增值税率23%，优惠税率13%')
    insertVatRate.run('GR', '希腊', 24, 13, '希腊标准增值税率24%，优惠税率13%')
    insertVatRate.run('IE', '爱尔兰', 23, 13.5, '爱尔兰标准增值税率23%，优惠税率13.5%')
    insertVatRate.run('CZ', '捷克', 21, 15, '捷克标准增值税率21%，优惠税率15%')
    insertVatRate.run('HU', '匈牙利', 27, 18, '匈牙利标准增值税率27%，优惠税率18%')
    insertVatRate.run('RO', '罗马尼亚', 19, 9, '罗马尼亚标准增值税率19%，优惠税率9%')
    insertVatRate.run('SK', '斯洛伐克', 20, 10, '斯洛伐克标准增值税率20%，优惠税率10%')
    insertVatRate.run('LU', '卢森堡', 17, 8, '卢森堡标准增值税率17%，优惠税率8%')
    console.log('已插入默认增值税率数据')
  }

  // 服务费项目表
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT DEFAULT 'EUR',
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_service_fees_category ON service_fees(category);
    CREATE INDEX IF NOT EXISTS idx_service_fees_active ON service_fees(is_active);
  `)

  // 插入默认服务费项目
  const existingFees = db.prepare('SELECT COUNT(*) as count FROM service_fees').get()
  if (existingFees.count === 0) {
    const insertFee = db.prepare(`
      INSERT INTO service_fees (name, category, unit, price, currency, description, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `)
    insertFee.run('报关费', '报关服务', '票', 150, 'EUR', '标准报关服务费')
    insertFee.run('查验费', '报关服务', '票', 200, 'EUR', '海关查验配合费')
    insertFee.run('T1转关费', '报关服务', '票', 80, 'EUR', 'T1转关手续费')
    insertFee.run('仓储费', '仓储服务', 'CBM/天', 3, 'EUR', '标准仓储费用')
    insertFee.run('装卸费', '仓储服务', 'CBM', 8, 'EUR', '货物装卸费')
    insertFee.run('派送费-标准', '运输服务', 'CBM', 45, 'EUR', '德国境内标准派送')
    insertFee.run('派送费-偏远', '运输服务', 'CBM', 65, 'EUR', '偏远地区派送附加费')
    insertFee.run('文件费', '其他服务', '票', 25, 'EUR', '单证处理费')
    console.log('已插入默认服务费项目')
  }

  // 运输价格表
  db.exec(`
    CREATE TABLE IF NOT EXISTS transport_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      transport_type TEXT NOT NULL,
      distance REAL NOT NULL,
      price_per_km REAL DEFAULT 0,
      total_price REAL DEFAULT 0,
      currency TEXT DEFAULT 'EUR',
      valid_from TEXT,
      valid_to TEXT,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // 为现有表添加新字段（如果不存在）
  try {
    db.exec(`ALTER TABLE transport_prices ADD COLUMN distance REAL DEFAULT 0`)
  } catch (err) {
    // 字段已存在，忽略错误
  }
  try {
    db.exec(`ALTER TABLE transport_prices ADD COLUMN price_per_km REAL DEFAULT 0`)
  } catch (err) {
    // 字段已存在，忽略错误
  }
  try {
    db.exec(`ALTER TABLE transport_prices ADD COLUMN total_price REAL DEFAULT 0`)
  } catch (err) {
    // 字段已存在，忽略错误
  }

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transport_prices_origin ON transport_prices(origin);
    CREATE INDEX IF NOT EXISTS idx_transport_prices_destination ON transport_prices(destination);
    CREATE INDEX IF NOT EXISTS idx_transport_prices_active ON transport_prices(is_active);
  `)

  // 插入默认运输价格
  const existingPrices = db.prepare('SELECT COUNT(*) as count FROM transport_prices').get()
  if (existingPrices.count === 0) {
    const insertPrice = db.prepare(`
      INSERT INTO transport_prices (name, origin, destination, transport_type, distance, price_per_km, total_price, currency, valid_from, valid_to, description, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `)
    // distance=公里数, price_per_km=公里单价, total_price=运输总价
    insertPrice.run('德国境内-标准派送', '汉堡港', '德国全境', '卡车', 500, 0.9, 450, 'EUR', '2024-01-01', '2024-12-31', '德国境内标准派送服务')
    insertPrice.run('德国境内-偏远地区', '汉堡港', '偏远地区', '卡车', 800, 1.0, 800, 'EUR', '2024-01-01', '2024-12-31', '偏远地区附加费')
    insertPrice.run('荷兰派送', '汉堡港', '荷兰', '卡车', 450, 0.85, 382.5, 'EUR', '2024-01-01', '2024-12-31', '荷兰全境派送')
    insertPrice.run('比利时派送', '汉堡港', '比利时', '卡车', 550, 0.88, 484, 'EUR', '2024-01-01', '2024-12-31', '比利时全境派送')
    insertPrice.run('法国派送', '汉堡港', '法国', '卡车', 900, 0.95, 855, 'EUR', '2024-01-01', '2024-12-31', '法国全境派送')
    insertPrice.run('波兰派送', '汉堡港', '波兰', '卡车', 650, 0.75, 487.5, 'EUR', '2024-01-01', '2024-12-31', '波兰全境派送')
    insertPrice.run('奥地利派送', '汉堡港', '奥地利', '卡车', 750, 0.92, 690, 'EUR', '2024-01-01', '2024-12-31', '奥地利全境派送')
    insertPrice.run('瑞士派送', '汉堡港', '瑞士', '卡车', 850, 1.2, 1020, 'EUR', '2024-01-01', '2024-12-31', '瑞士全境派送（含清关）')
    console.log('已插入默认运输价格')
  }

  // 系统设置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT NOT NULL UNIQUE,
      setting_value TEXT,
      setting_type TEXT DEFAULT 'string',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
  `)

  // ==================== TARIC 税率管理表 ====================
  db.exec(`
    CREATE TABLE IF NOT EXISTS tariff_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hs_code TEXT NOT NULL,
      hs_code_10 TEXT,
      goods_description TEXT NOT NULL,
      goods_description_cn TEXT,
      origin_country TEXT,
      origin_country_code TEXT,
      duty_rate REAL DEFAULT 0,
      duty_rate_type TEXT DEFAULT 'percentage',
      vat_rate REAL DEFAULT 19,
      anti_dumping_rate REAL DEFAULT 0,
      countervailing_rate REAL DEFAULT 0,
      preferential_rate REAL,
      preferential_origin TEXT,
      unit_code TEXT,
      unit_name TEXT,
      supplementary_unit TEXT,
      measure_type TEXT,
      measure_code TEXT,
      legal_base TEXT,
      start_date TEXT,
      end_date TEXT,
      quota_order_number TEXT,
      additional_code TEXT,
      footnotes TEXT,
      is_active INTEGER DEFAULT 1,
      data_source TEXT DEFAULT 'manual',
      last_sync_time DATETIME,
      declaration_type TEXT DEFAULT 'per_unit',
      min_declaration_value REAL DEFAULT 0,
      material TEXT,
      usage_scenario TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 添加新字段（兼容已存在的数据库）
  const tariffColumns = db.prepare("PRAGMA table_info(tariff_rates)").all()
  const tariffColumnNames = tariffColumns.map(c => c.name)
  if (!tariffColumnNames.includes('declaration_type')) {
    db.exec("ALTER TABLE tariff_rates ADD COLUMN declaration_type TEXT DEFAULT 'per_unit'")
    console.log('已添加 tariff_rates.declaration_type 字段')
  }
  if (!tariffColumnNames.includes('min_declaration_value')) {
    db.exec("ALTER TABLE tariff_rates ADD COLUMN min_declaration_value REAL DEFAULT 0")
    console.log('已添加 tariff_rates.min_declaration_value 字段')
  }
  if (!tariffColumnNames.includes('material')) {
    db.exec("ALTER TABLE tariff_rates ADD COLUMN material TEXT")
    console.log('已添加 tariff_rates.material 字段')
  }
  if (!tariffColumnNames.includes('usage_scenario')) {
    db.exec("ALTER TABLE tariff_rates ADD COLUMN usage_scenario TEXT")
    console.log('已添加 tariff_rates.usage_scenario 字段')
  }

  // 创建税率表索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tariff_rates_hs_code ON tariff_rates(hs_code);
    CREATE INDEX IF NOT EXISTS idx_tariff_rates_hs_code_10 ON tariff_rates(hs_code_10);
    CREATE INDEX IF NOT EXISTS idx_tariff_rates_origin ON tariff_rates(origin_country_code);
    CREATE INDEX IF NOT EXISTS idx_tariff_rates_active ON tariff_rates(is_active);
  `)

  // 税率变更历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS tariff_rate_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tariff_rate_id INTEGER NOT NULL,
      hs_code TEXT NOT NULL,
      old_duty_rate REAL,
      new_duty_rate REAL,
      old_vat_rate REAL,
      new_vat_rate REAL,
      change_type TEXT,
      change_reason TEXT,
      changed_by TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tariff_rate_id) REFERENCES tariff_rates(id)
    )
  `)

  // 创建历史表索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tariff_history_rate_id ON tariff_rate_history(tariff_rate_id);
    CREATE INDEX IF NOT EXISTS idx_tariff_history_hs_code ON tariff_rate_history(hs_code);
  `)

  // 插入一些示例税率数据
  const existingRates = db.prepare('SELECT COUNT(*) as count FROM tariff_rates').get()
  if (existingRates.count === 0) {
    const insertRate = db.prepare(`
      INSERT INTO tariff_rates (hs_code, hs_code_10, goods_description, goods_description_cn, origin_country, origin_country_code, duty_rate, duty_rate_type, vat_rate, unit_code, unit_name, data_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    // 示例数据
    insertRate.run('61091000', '6109100010', 'T-shirts, singlets and other vests, of cotton, knitted or crocheted', '棉制针织T恤衫', '中国', 'CN', 12, 'percentage', 19, 'KGM', '千克', 'sample')
    insertRate.run('84713000', '8471300000', 'Portable automatic data processing machines', '便携式自动数据处理设备', '中国', 'CN', 0, 'percentage', 19, 'PCE', '件', 'sample')
    insertRate.run('85171200', '8517120000', 'Telephones for cellular networks or for other wireless networks', '蜂窝网络或其他无线网络电话', '中国', 'CN', 0, 'percentage', 19, 'PCE', '件', 'sample')
    insertRate.run('94036090', '9403609090', 'Other wooden furniture', '其他木制家具', '中国', 'CN', 0, 'percentage', 19, 'KGM', '千克', 'sample')
    insertRate.run('64039900', '6403990090', 'Other footwear with outer soles of rubber, plastics, leather', '其他皮革面鞋靴', '中国', 'CN', 8, 'percentage', 19, 'PA2', '双', 'sample')
    insertRate.run('42022200', '4202220000', 'Handbags with outer surface of plastic sheeting or textile', '塑料或纺织材料面手提包', '中国', 'CN', 3, 'percentage', 19, 'PCE', '件', 'sample')
    insertRate.run('85287200', '8528720000', 'Other colour reception apparatus', '其他彩色电视接收装置', '中国', 'CN', 14, 'percentage', 19, 'PCE', '件', 'sample')
    insertRate.run('39269090', '3926909090', 'Other articles of plastics', '其他塑料制品', '中国', 'CN', 6.5, 'percentage', 19, 'KGM', '千克', 'sample')
    console.log('已插入示例税率数据')
  }

  // ==================== 安全管理表 ====================
  
  // 登录尝试记录表（用于账号锁定）
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      ip_address TEXT,
      attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      success INTEGER DEFAULT 0,
      failure_reason TEXT
    )
  `)

  // 清理30天前的登录尝试记录
  db.exec(`DELETE FROM login_attempts WHERE attempt_time < datetime('now', '-30 days')`)

  // 验证码表（用于邮箱验证）
  db.exec(`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT DEFAULT 'login',
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 清理过期的验证码
  db.exec(`DELETE FROM verification_codes WHERE expires_at < datetime('now')`)

  // 登录日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      logout_time DATETIME,
      ip_address TEXT,
      user_agent TEXT,
      device_info TEXT,
      location TEXT,
      status TEXT DEFAULT 'success',
      failure_reason TEXT
    )
  `)

  // 系统安全配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 初始化安全配置
  const securitySettings = [
    { key: 'login_lockout_attempts', value: '5', desc: '登录失败锁定次数' },
    { key: 'login_lockout_duration', value: '15', desc: '锁定时长（分钟）' },
    { key: 'password_min_length', value: '8', desc: '密码最小长度' },
    { key: 'password_require_uppercase', value: '1', desc: '密码需要大写字母' },
    { key: 'password_require_lowercase', value: '1', desc: '密码需要小写字母' },
    { key: 'password_require_number', value: '1', desc: '密码需要数字' },
    { key: 'password_require_special', value: '1', desc: '密码需要特殊字符' },
    { key: 'email_verification_enabled', value: '0', desc: '是否启用邮箱验证码登录' },
    { key: 'verification_code_expiry', value: '5', desc: '验证码有效期（分钟）' },
    { key: 'session_timeout', value: '480', desc: '会话超时时间（分钟）' },
  ]
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO security_settings (setting_key, setting_value, description) VALUES (?, ?, ?)
  `)
  securitySettings.forEach(s => insertSetting.run(s.key, s.value, s.desc))

  // ==================== 用户管理表 ====================
  
  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'operator',
      status TEXT DEFAULT 'active',
      last_login_time TEXT,
      last_login_ip TEXT,
      login_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // 创建用户名索引
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`)
  } catch (e) { /* 索引已存在 */ }

  // 角色表
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_code TEXT UNIQUE NOT NULL,
      role_name TEXT NOT NULL,
      description TEXT,
      is_system INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 权限表
  db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      permission_code TEXT UNIQUE NOT NULL,
      permission_name TEXT NOT NULL,
      module TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 角色-权限关联表
  db.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_code TEXT NOT NULL,
      permission_code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(role_code, permission_code)
    )
  `)

  // 用户-订单分配表（用于跟踪哪些订单分配给哪个操作员）
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_bill_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bill_id TEXT NOT NULL,
      assigned_by INTEGER,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(bill_id)
    )
  `)

  // ==================== Auth0 集成相关 ====================
  
  // 给 users 表添加 auth0_id 字段（用于绑定 Auth0 账号）
  try {
    db.exec(`ALTER TABLE users ADD COLUMN auth0_id TEXT UNIQUE`)
  } catch (e) { /* 字段已存在 */ }
  
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth0_id ON users(auth0_id)`)
  } catch (e) { /* 索引已存在 */ }
  
  // Auth0 待绑定用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth0_pending_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auth0_id TEXT UNIQUE NOT NULL,
      email TEXT,
      name TEXT,
      picture TEXT,
      first_login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_bound INTEGER DEFAULT 0,
      bound_user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_auth0_pending_auth0_id ON auth0_pending_users(auth0_id)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_auth0_pending_is_bound ON auth0_pending_users(is_bound)`)
  } catch (e) { /* 索引已存在 */ }

  // ==================== CRM客户关系管理表 ====================

  // 客户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      customer_code TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      company_name TEXT,
      customer_type TEXT DEFAULT 'shipper',
      customer_level TEXT DEFAULT 'normal',
      country_code TEXT,
      province TEXT,
      city TEXT,
      address TEXT,
      postal_code TEXT,
      contact_person TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      tax_number TEXT,
      bank_name TEXT,
      bank_account TEXT,
      credit_limit REAL DEFAULT 0,
      payment_terms TEXT,
      assigned_to INTEGER,
      assigned_name TEXT,
      tags TEXT DEFAULT '[]',
      notes TEXT,
      status TEXT DEFAULT 'active',
      last_follow_up_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 客户联系人表
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_contacts (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      position TEXT,
      department TEXT,
      phone TEXT,
      mobile TEXT,
      email TEXT,
      wechat TEXT,
      qq TEXT,
      is_primary INTEGER DEFAULT 0,
      is_decision_maker INTEGER DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 客户跟进记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_follow_ups (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      contact_id TEXT,
      follow_up_type TEXT DEFAULT 'other',
      follow_up_time DATETIME,
      content TEXT,
      result TEXT,
      next_follow_up_time DATETIME,
      next_action TEXT,
      operator_id INTEGER,
      operator_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 销售机会表
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_opportunities (
      id TEXT PRIMARY KEY,
      opportunity_name TEXT NOT NULL,
      customer_id TEXT,
      customer_name TEXT,
      contact_id TEXT,
      contact_name TEXT,
      stage TEXT DEFAULT 'lead',
      expected_amount REAL DEFAULT 0,
      probability INTEGER DEFAULT 0,
      expected_close_date DATE,
      source TEXT,
      description TEXT,
      assigned_to INTEGER,
      assigned_name TEXT,
      lost_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 报价单表
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotations (
      id TEXT PRIMARY KEY,
      quote_number TEXT UNIQUE NOT NULL,
      customer_id TEXT,
      customer_name TEXT,
      opportunity_id TEXT,
      contact_id TEXT,
      contact_name TEXT,
      subject TEXT,
      quote_date DATE,
      valid_until DATE,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      currency TEXT DEFAULT 'EUR',
      terms TEXT,
      notes TEXT,
      items TEXT DEFAULT '[]',
      status TEXT DEFAULT 'draft',
      created_by INTEGER,
      created_by_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 合同表
  db.exec(`
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      contract_number TEXT UNIQUE NOT NULL,
      contract_name TEXT NOT NULL,
      customer_id TEXT,
      customer_name TEXT,
      quotation_id TEXT,
      opportunity_id TEXT,
      contract_type TEXT DEFAULT 'service',
      contract_amount REAL DEFAULT 0,
      currency TEXT DEFAULT 'EUR',
      start_date DATE,
      end_date DATE,
      sign_date DATE,
      terms TEXT,
      notes TEXT,
      status TEXT DEFAULT 'draft',
      created_by INTEGER,
      created_by_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 客户反馈/投诉表
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_feedbacks (
      id TEXT PRIMARY KEY,
      feedback_number TEXT UNIQUE NOT NULL,
      customer_id TEXT,
      customer_name TEXT,
      contact_id TEXT,
      contact_name TEXT,
      feedback_type TEXT DEFAULT 'inquiry',
      subject TEXT NOT NULL,
      content TEXT,
      priority TEXT DEFAULT 'medium',
      source TEXT,
      bill_id TEXT,
      bill_number TEXT,
      assigned_to INTEGER,
      assigned_name TEXT,
      status TEXT DEFAULT 'open',
      resolution TEXT,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 初始化CRM示例数据
  const existingCustomers = db.prepare('SELECT COUNT(*) as count FROM customers').get()
  if (existingCustomers.count === 0) {
    const insertCustomer = db.prepare(`
      INSERT INTO customers (id, customer_code, customer_name, company_name, customer_type, customer_level, contact_person, contact_phone, contact_email, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    insertCustomer.run('cust001', 'C20240001', '张三物流', '张三物流有限公司', 'shipper', 'vip', '张三', '13800138001', 'zhangsan@example.com', 'active')
    insertCustomer.run('cust002', 'C20240002', '李四贸易', '李四国际贸易公司', 'consignee', 'important', '李四', '13800138002', 'lisi@example.com', 'active')
    insertCustomer.run('cust003', 'C20240003', 'ABC Trading', 'ABC Trading Co., Ltd.', 'shipper', 'normal', 'John', '+49123456789', 'john@abc.com', 'active')
    insertCustomer.run('cust004', 'C20240004', 'XYZ Import', 'XYZ Import & Export', 'consignee', 'normal', 'Mike', '+86755123456', 'mike@xyz.com', 'active')
    insertCustomer.run('cust005', 'C20240005', '测试客户', '测试公司', 'shipper', 'potential', '测试', '13900000000', 'test@test.com', 'active')
    console.log('已初始化CRM客户示例数据')

    // 初始化跟进记录
    const insertFollowUp = db.prepare(`
      INSERT INTO customer_follow_ups (id, customer_id, follow_up_type, follow_up_time, content, operator_name)
      VALUES (?, ?, ?, datetime('now', 'localtime'), ?, ?)
    `)
    insertFollowUp.run('fu001', 'cust001', 'phone', '电话沟通新订单需求', '管理员')
    insertFollowUp.run('fu002', 'cust002', 'email', '发送报价单', '管理员')
    insertFollowUp.run('fu003', 'cust001', 'meeting', '线下会议洽谈合作', '管理员')
    console.log('已初始化CRM跟进记录示例数据')

    // 初始化销售机会
    const insertOpportunity = db.prepare(`
      INSERT INTO sales_opportunities (id, opportunity_name, customer_id, customer_name, stage, expected_amount, probability, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    insertOpportunity.run('opp001', '张三物流年度物流合作', 'cust001', '张三物流', 'negotiation', 500000, 70, '预计年度物流费用约50万')
    insertOpportunity.run('opp002', 'ABC欧洲航线代理', 'cust003', 'ABC Trading', 'proposal', 200000, 50, '欧洲航线运输代理服务')
    insertOpportunity.run('opp003', 'XYZ进口报关服务', 'cust004', 'XYZ Import', 'lead', 80000, 20, '进口报关及清关服务')
    console.log('已初始化CRM销售机会示例数据')
  }

  // 初始化系统角色
  const existingRoles = db.prepare('SELECT COUNT(*) as count FROM roles').get()
  if (existingRoles.count === 0) {
    const insertRole = db.prepare(`
      INSERT INTO roles (role_code, role_name, description, is_system)
      VALUES (?, ?, ?, ?)
    `)
    insertRole.run('admin', '系统管理员', '拥有所有权限，可管理用户和系统设置', 1)
    insertRole.run('manager', '业务经理', '可查看所有订单，管理操作员', 1)
    insertRole.run('operator', '操作员', '处理分配的订单，执行日常操作', 1)
    insertRole.run('viewer', '查看者', '只能查看分配的订单，无法操作', 1)
    console.log('已初始化系统角色')
  }

  // 初始化权限
  const existingPermissions = db.prepare('SELECT COUNT(*) as count FROM permissions').get()
  if (existingPermissions.count === 0) {
    const insertPermission = db.prepare(`
      INSERT INTO permissions (permission_code, permission_name, module, description, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `)
    // 订单模块权限
    insertPermission.run('bill:view', '查看提单', 'order', '查看提单列表和详情', 100)
    insertPermission.run('bill:create', '创建提单', 'order', '创建新提单', 101)
    insertPermission.run('bill:edit', '编辑提单', 'order', '编辑提单信息', 102)
    insertPermission.run('bill:delete', '删除提单', 'order', '删除或作废提单', 103)
    insertPermission.run('bill:view_all', '查看所有提单', 'order', '查看所有人的提单（不限于分配的）', 104)
    
    // 查验模块权限
    insertPermission.run('inspection:view', '查看查验', 'inspection', '查看查验列表', 200)
    insertPermission.run('inspection:operate', '查验操作', 'inspection', '执行查验相关操作', 201)
    
    // CMR模块权限
    insertPermission.run('cmr:view', '查看CMR', 'cmr', '查看CMR列表', 300)
    insertPermission.run('cmr:operate', 'CMR操作', 'cmr', '执行CMR派送操作', 301)
    
    // 工具模块权限
    insertPermission.run('tool:inquiry', '报价管理', 'tool', '访问报价管理功能', 400)
    insertPermission.run('tool:tariff', '关税计算', 'tool', '访问关税计算功能', 401)
    insertPermission.run('tool:payment', '付款发票', 'tool', '访问付款发票功能', 402)
    insertPermission.run('tool:address', '地址税号', 'tool', '访问地址税号功能', 403)
    insertPermission.run('tool:commodity', '海关编码', 'tool', '访问海关编码功能', 404)
    insertPermission.run('tool:category', '品类库', 'tool', '访问品类库功能', 405)
    
    // 系统管理权限
    insertPermission.run('system:menu', '板块开关', 'system', '管理系统菜单开关', 500)
    insertPermission.run('system:user', '用户管理', 'system', '管理用户账号', 501)
    insertPermission.run('system:logo', 'Logo管理', 'system', '管理系统Logo', 502)
    insertPermission.run('system:basic_data', '基础数据', 'system', '管理基础数据', 503)
    insertPermission.run('system:tariff_rate', '税率管理', 'system', '管理税率数据', 504)
    
    console.log('已初始化系统权限')
  }

  // 初始化角色-权限关联
  const existingRolePermissions = db.prepare('SELECT COUNT(*) as count FROM role_permissions').get()
  if (existingRolePermissions.count === 0) {
    const insertRolePermission = db.prepare(`
      INSERT OR IGNORE INTO role_permissions (role_code, permission_code)
      VALUES (?, ?)
    `)
    
    // 管理员拥有所有权限
    const allPermissions = db.prepare('SELECT permission_code FROM permissions').all()
    for (const p of allPermissions) {
      insertRolePermission.run('admin', p.permission_code)
    }
    
    // 业务经理权限
    const managerPermissions = [
      'bill:view', 'bill:create', 'bill:edit', 'bill:view_all',
      'inspection:view', 'inspection:operate',
      'cmr:view', 'cmr:operate',
      'tool:inquiry', 'tool:tariff', 'tool:payment', 'tool:address', 'tool:commodity', 'tool:category'
    ]
    for (const p of managerPermissions) {
      insertRolePermission.run('manager', p)
    }
    
    // 操作员权限
    const operatorPermissions = [
      'bill:view', 'bill:create', 'bill:edit',
      'inspection:view', 'inspection:operate',
      'cmr:view', 'cmr:operate',
      'tool:inquiry', 'tool:tariff', 'tool:address', 'tool:commodity', 'tool:category'
    ]
    for (const p of operatorPermissions) {
      insertRolePermission.run('operator', p)
    }
    
    // 查看者权限
    const viewerPermissions = [
      'bill:view',
      'inspection:view',
      'cmr:view',
      'tool:tariff', 'tool:commodity'
    ]
    for (const p of viewerPermissions) {
      insertRolePermission.run('viewer', p)
    }
    
    console.log('已初始化角色权限关联')
  }

  // 创建默认管理员账号（密码: admin123）
  // 使用简单的哈希，生产环境应使用bcrypt
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get()
  if (existingUsers.count === 0) {
    // 简单的密码哈希函数（仅用于演示，生产环境应使用bcrypt）
    const localHashPassword = (password) => {
      return crypto.createHash('sha256').update(password + 'sysafari_salt').digest('hex')
    }
    
    // 使用明确的ID从1001开始插入默认用户
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, password_hash, name, email, phone, role, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    insertUser.run(1001, 'admin', localHashPassword('admin123'), '系统管理员', 'admin@xianfenghk.com', '13800138000', 'admin', 'active')
    insertUser.run(1002, 'manager', localHashPassword('manager123'), '业务经理', 'manager@xianfenghk.com', '13800138001', 'manager', 'active')
    insertUser.run(1003, 'operator1', localHashPassword('operator123'), '操作员1', 'op1@xianfenghk.com', '13800138002', 'operator', 'active')
    insertUser.run(1004, 'operator2', localHashPassword('operator123'), '操作员2', 'op2@xianfenghk.com', '13800138003', 'operator', 'active')
    insertUser.run(1005, 'viewer1', localHashPassword('viewer123'), '查看者', 'viewer@xianfenghk.com', '13800138004', 'viewer', 'active')
    console.log('已创建默认用户账号 (ID从1001开始)')
    console.log('默认账号密码：')
    console.log('  admin / admin123 (管理员) - ID: 1001')
    console.log('  manager / manager123 (业务经理) - ID: 1002')
    console.log('  operator1 / operator123 (操作员) - ID: 1003')
    console.log('  operator2 / operator123 (操作员) - ID: 1004')
    console.log('  viewer1 / viewer123 (查看者) - ID: 1005')
  }

  // 为提单表添加操作员字段
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN assigned_operator_id INTEGER`)
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE bills_of_lading ADD COLUMN assigned_operator_name TEXT`)
  } catch (e) { /* 列已存在 */ }

  console.log('数据库初始化完成')
}

/**
 * 为指定表的现有数据分配序号，并同步序列表
 * @param {string} tableName - 表名
 * @param {string} businessType - 业务类型
 */
function initializeSequenceForTable(tableName, businessType) {
  // 首先，同步序列表中的current_seq与表中的最大order_seq
  try {
    const maxSeqResult = db.prepare(`SELECT MAX(order_seq) as max_seq FROM ${tableName}`).get()
    const maxSeq = maxSeqResult?.max_seq || 0
    
    const currentSeqResult = db.prepare(`SELECT current_seq FROM order_sequences WHERE business_type = ?`).get(businessType)
    const currentSeq = currentSeqResult?.current_seq || 0
    
    // 如果表中的最大序号大于序列表中的当前序号，则同步
    if (maxSeq > currentSeq) {
      db.prepare(`UPDATE order_sequences SET current_seq = ?, updated_at = CURRENT_TIMESTAMP WHERE business_type = ?`)
        .run(maxSeq, businessType)
      console.log(`[${businessType}] 同步序号: ${currentSeq} -> ${maxSeq}`)
    }
  } catch (e) {
    // 表可能不存在order_seq列，忽略
  }
  
  // 然后，为没有序号的记录分配序号
  const recordsWithoutSeq = db.prepare(`SELECT id FROM ${tableName} WHERE order_seq IS NULL ORDER BY create_time ASC, id ASC`).all()
  if (recordsWithoutSeq.length > 0) {
    // 获取当前业务类型的最大序号（从已同步的序列表中获取）
    const currentSeqResult = db.prepare(`SELECT current_seq FROM order_sequences WHERE business_type = ?`).get(businessType)
    let nextSeq = (currentSeqResult?.current_seq || 0) + 1
    
    const updateStmt = db.prepare(`UPDATE ${tableName} SET order_seq = ? WHERE id = ?`)
    for (const record of recordsWithoutSeq) {
      updateStmt.run(nextSeq, record.id)
      nextSeq++
    }
    
    // 更新序列表中的当前序号
    db.prepare(`UPDATE order_sequences SET current_seq = ?, updated_at = CURRENT_TIMESTAMP WHERE business_type = ?`)
      .run(nextSeq - 1, businessType)
    
    console.log(`[${businessType}] 已为 ${recordsWithoutSeq.length} 条记录分配序号`)
  }
}

/**
 * 为指定表的现有数据分配序号（带条件过滤）
 * @param {string} tableName - 表名
 * @param {string} businessType - 业务类型
 * @param {string} condition - SQL条件，如 "status = '草稿'"
 */
function initializeSequenceForTableWithCondition(tableName, businessType, condition) {
  // 首先，同步序列表中的current_seq与表中符合条件的最大order_seq
  try {
    const maxSeqResult = db.prepare(`SELECT MAX(order_seq) as max_seq FROM ${tableName} WHERE ${condition}`).get()
    const maxSeq = maxSeqResult?.max_seq || 0
    
    const currentSeqResult = db.prepare(`SELECT current_seq FROM order_sequences WHERE business_type = ?`).get(businessType)
    const currentSeq = currentSeqResult?.current_seq || 0
    
    // 如果表中的最大序号大于序列表中的当前序号，则同步
    if (maxSeq > currentSeq) {
      db.prepare(`UPDATE order_sequences SET current_seq = ?, updated_at = CURRENT_TIMESTAMP WHERE business_type = ?`)
        .run(maxSeq, businessType)
      console.log(`[${businessType}] 同步序号: ${currentSeq} -> ${maxSeq}`)
    }
  } catch (e) {
    // 表可能不存在order_seq列，忽略
  }
  
  // 然后，为符合条件且没有序号的记录分配序号
  const recordsWithoutSeq = db.prepare(`SELECT id FROM ${tableName} WHERE ${condition} AND order_seq IS NULL ORDER BY create_time ASC, id ASC`).all()
  if (recordsWithoutSeq.length > 0) {
    // 获取当前业务类型的最大序号（从已同步的序列表中获取）
    const currentSeqResult = db.prepare(`SELECT current_seq FROM order_sequences WHERE business_type = ?`).get(businessType)
    let nextSeq = (currentSeqResult?.current_seq || 0) + 1
    
    const updateStmt = db.prepare(`UPDATE ${tableName} SET order_seq = ? WHERE id = ?`)
    for (const record of recordsWithoutSeq) {
      updateStmt.run(nextSeq, record.id)
      nextSeq++
    }
    
    // 更新序列表中的当前序号
    db.prepare(`UPDATE order_sequences SET current_seq = ?, updated_at = CURRENT_TIMESTAMP WHERE business_type = ?`)
      .run(nextSeq - 1, businessType)
    
    console.log(`[${businessType}] 已为 ${recordsWithoutSeq.length} 条记录分配序号`)
  }
}

/**
 * 获取下一个订单序号（按业务类型）
 * @param {string} businessType - 业务类型: 'package', 'bill', 'draft', 'declaration', 'label', 'last_mile'
 * @returns {number} 下一个序号
 */
function getNextOrderSeq(businessType) {
  // 使用事务确保序号唯一性
  return db.transaction(() => {
    // 获取当前序号
    const currentSeqResult = db.prepare(`SELECT current_seq FROM order_sequences WHERE business_type = ?`).get(businessType)
    const currentSeq = currentSeqResult?.current_seq || 0
    
    // 计算下一个序号
    const nextSeq = currentSeq + 1
    
    // 更新序号
    db.prepare(`
      UPDATE order_sequences 
      SET current_seq = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE business_type = ?
    `).run(nextSeq, businessType)
    
    return nextSeq
  })()
}

/**
 * 获取序号信息（包含前缀）
 * @param {string} businessType - 业务类型
 * @returns {object} { seq: number, prefix: string, formatted: string }
 */
function getSequenceInfo(businessType) {
  const seqResult = db.prepare(`SELECT current_seq, prefix FROM order_sequences WHERE business_type = ?`).get(businessType)
  const nextSeq = getNextOrderSeq(businessType)
  return {
    seq: nextSeq,
    prefix: seqResult?.prefix || '',
    formatted: `${seqResult?.prefix || ''}${String(nextSeq).padStart(6, '0')}`
  }
}

// 初始化数据库（PostgreSQL 模式下跳过，表已通过迁移脚本创建）
if (!USE_POSTGRES) {
  initDatabase()
} else {
  console.log('🌐 PostgreSQL 模式：跳过本地数据库初始化（表已存在）')
  
  // PostgreSQL 模式下，确保 suppliers 表存在
  ;(async () => {
    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id TEXT PRIMARY KEY,
          supplier_code TEXT UNIQUE NOT NULL,
          supplier_name TEXT NOT NULL,
          short_name TEXT,
          supplier_type TEXT DEFAULT 'trader',
          contact_person TEXT,
          contact_phone TEXT,
          contact_email TEXT,
          contact_mobile TEXT,
          fax TEXT,
          website TEXT,
          country TEXT,
          province TEXT,
          city TEXT,
          address TEXT,
          postal_code TEXT,
          tax_number TEXT,
          bank_name TEXT,
          bank_account TEXT,
          bank_branch TEXT,
          currency TEXT DEFAULT 'EUR',
          payment_terms TEXT,
          credit_limit REAL DEFAULT 0,
          status TEXT DEFAULT 'active',
          level TEXT DEFAULT 'new',
          rating INTEGER DEFAULT 0,
          cooperation_date TEXT,
          contract_expire_date TEXT,
          remark TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          updated_by TEXT
        )
      `)
      console.log('✅ PostgreSQL: suppliers 表已确保存在')
    } catch (error) {
      console.error('❌ 创建 suppliers 表失败:', error.message)
    }
  })()
}

// 记录操作日志
function logOperation(billId, operationType, operationName, oldValue, newValue, operator = 'admin', remark = '') {
  try {
    const operationTime = new Date().toISOString()
    db.prepare(`
      INSERT INTO operation_logs (bill_id, operation_type, operation_name, old_value, new_value, operator, remark, operation_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(billId, operationType, operationName, oldValue, newValue, operator, remark, operationTime)
    console.log(`[操作日志] ${operationName}: ${oldValue || '-'} -> ${newValue || '-'}`)
  } catch (error) {
    console.error('记录操作日志失败:', error)
  }
}

// 数据格式转换函数：将数据库的下划线格式转换为前端的驼峰格式
function convertToCamelCase(obj) {
  if (!obj) return obj
  return {
    id: obj.id,
    billId: obj.bill_id,
    billNumber: obj.bill_number,
    containerNumber: obj.container_number,
    actualContainerNo: obj.actual_container_no,
    vessel: obj.vessel,
    eta: obj.eta,
    ata: obj.ata,
    pieces: obj.pieces,
    weight: obj.weight,
    volume: obj.volume,
    inspection: obj.inspection,
    customsStats: obj.customs_stats,
    creator: obj.creator,
    createTime: obj.create_time,
    status: obj.status,
    shipper: obj.shipper,
    consignee: obj.consignee,
    notifyParty: obj.notify_party,
    portOfLoading: obj.port_of_loading,
    portOfDischarge: obj.port_of_discharge,
    placeOfDelivery: obj.place_of_delivery,
    completeTime: obj.complete_time,
    deliveryStatus: obj.delivery_status,
    transportMethod: obj.transport_method,
    companyName: obj.company_name,
    orderSeq: obj.order_seq,
    isVoid: obj.is_void === 1,
    voidReason: obj.void_reason,
    voidTime: obj.void_time,
    shipStatus: obj.ship_status || '未到港',
    skipPort: obj.skip_port,
    skipPortTime: obj.skip_port_time,
    customsStatus: obj.customs_status || '未放行',
    customsReleaseTime: obj.customs_release_time,
    actualArrivalDate: obj.actual_arrival_date,
    inspectionDetail: obj.inspection_detail ? JSON.parse(obj.inspection_detail) : null,
    inspectionEstimatedTime: obj.inspection_estimated_time,
    inspectionStartTime: obj.inspection_start_time,
    inspectionEndTime: obj.inspection_end_time,
    inspectionResult: obj.inspection_result,
    inspectionResultNote: obj.inspection_result_note,
    inspectionReleaseTime: obj.inspection_release_time,
    inspectionConfirmedTime: obj.inspection_confirmed_time,
    // CMR/派送相关字段
    cmrDetail: obj.cmr_detail,
    cmrEstimatedPickupTime: obj.cmr_estimated_pickup_time,
    cmrServiceProvider: obj.cmr_service_provider,
    cmrDeliveryAddress: obj.cmr_delivery_address,
    cmrEstimatedArrivalTime: obj.cmr_estimated_arrival_time,
    cmrActualArrivalTime: obj.cmr_actual_arrival_time,
    cmrUnloadingCompleteTime: obj.cmr_unloading_complete_time,
    cmrConfirmedTime: obj.cmr_confirmed_time,
    cmrHasException: obj.cmr_has_exception,
    cmrExceptionNote: obj.cmr_exception_note,
    cmrExceptionTime: obj.cmr_exception_time,
    cmrExceptionStatus: obj.cmr_exception_status,
    cmrExceptionRecords: obj.cmr_exception_records,
    cmrExceptionResolution: obj.cmr_exception_resolution,
    cmrExceptionResolvedTime: obj.cmr_exception_resolved_time,
    cmrNotes: obj.cmr_notes,
  }
}

// ==================== API 路由 ====================

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

// ==================== 海运公司相关 API ====================

// 获取所有海运公司列表
app.get('/api/shipping-companies', (req, res) => {
  try {
    const { search } = req.query
    let query = 'SELECT * FROM shipping_companies WHERE 1=1'
    const params = []

    if (search) {
      query += ' AND (company_name LIKE ? OR company_code LIKE ? OR country LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern)
    }

    query += ' ORDER BY company_name'

    const companies = db.prepare(query).all(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: companies.map(item => ({
        id: String(item.id),
        companyName: item.company_name,
        companyCode: item.company_code,
        country: item.country || '',
        website: item.website || '',
        createTime: item.created_at,
        updateTime: item.updated_at,
      })),
    })
  } catch (error) {
    console.error('获取海运公司列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取海运公司列表失败',
      error: error.message,
    })
  }
})

// 获取海运公司详情
app.get('/api/shipping-companies/:id', (req, res) => {
  try {
    const { id } = req.params
    const data = db.prepare('SELECT * FROM shipping_companies WHERE id = ?').get(id)
    
    if (!data) {
      return res.status(404).json({
        errCode: 404,
        msg: '海运公司不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: String(data.id),
        companyName: data.company_name,
        companyCode: data.company_code,
        country: data.country || '',
        website: data.website || '',
        createTime: data.created_at,
        updateTime: data.updated_at,
      },
    })
  } catch (error) {
    console.error('获取海运公司详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取海运公司详情失败',
    })
  }
})

// 创建海运公司
app.post('/api/shipping-companies', (req, res) => {
  try {
    const { companyName, companyCode, country, website } = req.body

    if (!companyName || !companyCode) {
      return res.status(400).json({
        errCode: 400,
        msg: '公司名称和公司代码为必填项',
      })
    }

    // 检查代码是否已存在
    const existing = db.prepare('SELECT * FROM shipping_companies WHERE company_code = ?').get(companyCode.toUpperCase())
    if (existing) {
      return res.status(400).json({
        errCode: 400,
        msg: '公司代码已存在',
      })
    }

    const result = db.prepare(`
      INSERT INTO shipping_companies (company_name, company_code, country, website)
      VALUES (?, ?, ?, ?)
    `).run(
      companyName,
      companyCode.toUpperCase(),
      country || '',
      website || ''
    )

    res.json({
      errCode: 200,
      msg: '创建成功',
      data: {
        id: String(result.lastInsertRowid),
        companyName,
        companyCode: companyCode.toUpperCase(),
        country: country || '',
        website: website || '',
      },
    })
  } catch (error) {
    console.error('创建海运公司失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建海运公司失败',
    })
  }
})

// 更新海运公司
app.put('/api/shipping-companies/:id', (req, res) => {
  try {
    const { id } = req.params
    const { companyName, companyCode, country, website } = req.body

    if (!companyName || !companyCode) {
      return res.status(400).json({
        errCode: 400,
        msg: '公司名称和公司代码为必填项',
      })
    }

    // 检查代码是否被其他记录使用
    const existing = db.prepare('SELECT * FROM shipping_companies WHERE company_code = ? AND id != ?').get(companyCode.toUpperCase(), id)
    if (existing) {
      return res.status(400).json({
        errCode: 400,
        msg: '公司代码已被其他记录使用',
      })
    }

    db.prepare(`
      UPDATE shipping_companies 
      SET company_name = ?, company_code = ?, country = ?, website = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      companyName,
      companyCode.toUpperCase(),
      country || '',
      website || '',
      id
    )

    res.json({
      errCode: 200,
      msg: '更新成功',
    })
  } catch (error) {
    console.error('更新海运公司失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新海运公司失败',
    })
  }
})

// 删除海运公司
app.delete('/api/shipping-companies/:id', (req, res) => {
  try {
    const { id } = req.params
    
    // 检查是否有集装箱代码关联
    const containerCodes = db.prepare('SELECT COUNT(*) as count FROM container_codes WHERE shipping_company_id = ?').get(id)
    if (containerCodes.count > 0) {
      return res.status(400).json({
        errCode: 400,
        msg: '该海运公司下还有集装箱代码，无法删除',
      })
    }
    
    const result = db.prepare('DELETE FROM shipping_companies WHERE id = ?').run(id)
    
    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '海运公司不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '删除成功',
    })
  } catch (error) {
    console.error('删除海运公司失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除海运公司失败',
    })
  }
})

// 根据集装箱代码获取海运公司信息
app.get('/api/shipping-companies/by-container-code/:code', (req, res) => {
  try {
    const { code } = req.params
    const containerCode = code.toUpperCase()
    
    const result = db.prepare(`
      SELECT sc.*, cc.container_code, cc.description
      FROM container_codes cc
      JOIN shipping_companies sc ON cc.shipping_company_id = sc.id
      WHERE cc.container_code = ?
      LIMIT 1
    `).get(containerCode)
    
    if (!result) {
      return res.status(404).json({
        errCode: 404,
        msg: '未找到对应的海运公司',
      })
    }
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        companyName: result.company_name,
        companyCode: result.company_code,
        containerCode: result.container_code,
        country: result.country,
        website: result.website,
      },
    })
  } catch (error) {
    console.error('根据集装箱代码获取海运公司失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取海运公司信息失败',
      error: error.message,
    })
  }
})

// 获取指定海运公司的所有集装箱代码
app.get('/api/shipping-companies/:companyCode/container-codes', (req, res) => {
  try {
    const { companyCode } = req.params
    
    const codes = db.prepare(`
      SELECT cc.container_code, cc.description
      FROM container_codes cc
      JOIN shipping_companies sc ON cc.shipping_company_id = sc.id
      WHERE sc.company_code = ?
      ORDER BY cc.container_code
    `).all(companyCode)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: codes,
    })
  } catch (error) {
    console.error('获取集装箱代码列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取集装箱代码列表失败',
      error: error.message,
    })
  }
})

// 搜索集装箱代码（支持模糊匹配）
app.get('/api/container-codes/search', (req, res) => {
  try {
    const { q = '' } = req.query
    
    let codes
    if (!q || q.trim() === '') {
      // 如果查询为空，返回所有集装箱代码
      codes = db.prepare(`
        SELECT cc.container_code, cc.description, sc.company_name, sc.company_code
        FROM container_codes cc
        JOIN shipping_companies sc ON cc.shipping_company_id = sc.id
        ORDER BY cc.container_code
        LIMIT 500
      `).all()
    } else {
      // 如果有查询条件，进行模糊匹配
      codes = db.prepare(`
        SELECT cc.container_code, cc.description, sc.company_name, sc.company_code
        FROM container_codes cc
        JOIN shipping_companies sc ON cc.shipping_company_id = sc.id
        WHERE cc.container_code LIKE ? OR sc.company_name LIKE ? OR sc.company_code LIKE ?
        ORDER BY cc.container_code
        LIMIT 100
      `).all(`%${q.toUpperCase()}%`, `%${q}%`, `%${q.toUpperCase()}%`)
    }
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: codes,
    })
  } catch (error) {
    console.error('搜索集装箱代码失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '搜索集装箱代码失败',
      error: error.message,
    })
  }
})

// 获取提单列表
app.get('/api/bills', (req, res) => {
  try {
    const { 
      page = 1, 
      pageSize = 10, 
      search = '', 
      status = '',
      type = 'schedule', // 'schedule' 或 'draft' 或 'history' 或 'void'
      includeVoid = 'false' // 是否包含作废订单
    } = req.query

    let query = 'SELECT * FROM bills_of_lading WHERE 1=1'
    const params = []

    // 根据类型过滤
    // schedule: 进行中的提单（不包含作废，不包含已送达）
    // draft: 草稿/未完成的提单
    // history: 已完成/已归档的历史订单（包含已送达的提单）
    // void: 已作废的提单
    if (type === 'void') {
      query += ' AND is_void = 1'
    } else if (type === 'schedule') {
      // 排除已送达的提单，这些应该转移到历史/归档
      // 使用 ship_status 字段过滤船运状态：已到港、未到港、跳港
      query += ' AND ship_status IN (?, ?, ?) AND (is_void = 0 OR is_void IS NULL) AND (delivery_status IS NULL OR delivery_status != ?)'
      params.push('已到港', '船未到港', '跳港', '已送达')
    } else if (type === 'draft') {
      query += ' AND status = ? AND (is_void = 0 OR is_void IS NULL)'
      params.push('draft')
    } else if (type === 'history') {
      // 包含状态为已完成/已归档的，以及派送状态为已送达的提单
      query += ' AND ((status IN (?, ?)) OR (delivery_status = ?)) AND (is_void = 0 OR is_void IS NULL)'
      params.push('completed', 'archived', '已送达')
    } else {
      // 默认不包含作废订单，除非明确指定
      if (includeVoid !== 'true') {
        query += ' AND (is_void = 0 OR is_void IS NULL)'
      }
    }

    // 状态过滤
    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    // 搜索过滤
    if (search) {
      query += ' AND (bill_number LIKE ? OR container_number LIKE ? OR vessel LIKE ? OR bill_id LIKE ? OR CAST(order_seq AS TEXT) LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern)
    }

    // 排序：按序号降序
    query += ' ORDER BY order_seq DESC, create_time DESC'

    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count')
    const countResult = db.prepare(countQuery).get(...params)
    const total = countResult.count

    // 获取各类型的统计数据
    const statsQuery = `
      SELECT 
        COUNT(*) as allTotal,
        SUM(CASE WHEN ship_status IN ('已到港', '船未到港', '跳港') AND (is_void = 0 OR is_void IS NULL) AND (delivery_status IS NULL OR delivery_status != '已送达') THEN 1 ELSE 0 END) as scheduleCount,
        SUM(CASE WHEN status = 'draft' AND (is_void = 0 OR is_void IS NULL) THEN 1 ELSE 0 END) as draftCount,
        SUM(CASE WHEN ((status IN ('completed', 'archived')) OR (delivery_status = '已送达')) AND (is_void = 0 OR is_void IS NULL) THEN 1 ELSE 0 END) as historyCount,
        SUM(CASE WHEN is_void = 1 THEN 1 ELSE 0 END) as voidCount,
        SUM(CASE WHEN is_void = 0 OR is_void IS NULL THEN 1 ELSE 0 END) as validCount
      FROM bills_of_lading
    `
    const statsResult = db.prepare(statsQuery).get()
    
    // 根据当前类型返回对应的统计
    let currentTypeCount = total
    if (type === 'schedule') currentTypeCount = statsResult.scheduleCount
    else if (type === 'draft') currentTypeCount = statsResult.draftCount
    else if (type === 'history') currentTypeCount = statsResult.historyCount
    else if (type === 'void') currentTypeCount = statsResult.voidCount

    // 分页
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    query += ' LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), offset)

    const bills = db.prepare(query).all(...params)
    const convertedBills = bills.map(convertToCamelCase)

    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        list: convertedBills,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        stats: {
          // 当前类型的数量
          currentTypeCount,
          // 各类型数量
          scheduleCount: statsResult.scheduleCount,
          draftCount: statsResult.draftCount,
          historyCount: statsResult.historyCount,
          voidCount: statsResult.voidCount,
          // 总体统计
          allTotal: statsResult.allTotal,
          validCount: statsResult.validCount,
        },
      },
    })
  } catch (error) {
    console.error('获取提单列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取提单列表失败',
      error: error.message,
    })
  }
})

// 获取提单详情
app.get('/api/bills/:id', (req, res) => {
  try {
    const { id } = req.params
    const bill = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)

    if (!bill) {
      return res.status(404).json({
        errCode: 404,
        msg: '提单不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: 'success',
      data: convertToCamelCase(bill),
    })
  } catch (error) {
    console.error('获取提单详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取提单详情失败',
      error: error.message,
    })
  }
})

// 获取提单操作日志
app.get('/api/bills/:id/logs', (req, res) => {
  try {
    const { id } = req.params
    
    // 检查提单是否存在
    const bill = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    if (!bill) {
      return res.status(404).json({
        errCode: 404,
        msg: '提单不存在',
      })
    }
    
    // 获取操作日志，按时间倒序
    const logs = db.prepare(`
      SELECT * FROM operation_logs 
      WHERE bill_id = ? 
      ORDER BY operation_time DESC
    `).all(id)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: logs.map(log => ({
        id: log.id,
        billId: log.bill_id,
        operationType: log.operation_type,
        operationName: log.operation_name,
        oldValue: log.old_value,
        newValue: log.new_value,
        operator: log.operator,
        remark: log.remark,
        operationTime: log.operation_time,
      })),
    })
  } catch (error) {
    console.error('获取操作日志失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取操作日志失败',
      error: error.message,
    })
  }
})

// 创建提单
app.post('/api/bills', (req, res) => {
  try {
    // 支持驼峰命名和下划线命名
    const data = req.body
    const bill_id = data.billId || data.bill_id
    const bill_number = data.billNumber || data.bill_number
    const container_number = data.containerNumber || data.container_number
    const vessel = data.vessel
    const eta = data.eta
    const ata = data.ata
    const pieces = data.pieces
    const weight = data.weight
    const volume = data.volume
    const inspection = data.inspection
    const customs_stats = data.customsStats || data.customs_stats
    const creator = data.creator
    const create_time = data.createTime || data.create_time
    const status = data.status
    const shipper = data.shipper
    const consignee = data.consignee
    const notify_party = data.notifyParty || data.notify_party
    const port_of_loading = data.portOfLoading || data.port_of_loading
    const port_of_discharge = data.portOfDischarge || data.port_of_discharge
    const place_of_delivery = data.placeOfDelivery || data.place_of_delivery
    const transport_method = data.transportMethod || data.transport_method
    const company_name = data.companyName || data.company_name

    const id = Date.now().toString()
    const now = new Date().toISOString()

    // 根据状态获取下一个序号（草稿和正式订单使用独立序号）
    const isDraft = status === '草稿'
    const nextOrderSeq = getNextOrderSeq(isDraft ? 'draft' : 'bill')

    const stmt = db.prepare(`
      INSERT INTO bills_of_lading (
        id, bill_id, bill_number, container_number, vessel, eta, ata,
        pieces, weight, volume, inspection, customs_stats, creator, create_time,
        status, shipper, consignee, notify_party, port_of_loading,
        port_of_discharge, place_of_delivery, transport_method, company_name,
        order_seq, is_void, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      bill_id || null,
      bill_number,
      container_number || null,
      vessel || null,
      eta || null,
      ata || null,
      pieces || 0,
      weight || 0,
      volume || null,
      inspection || '-',
      customs_stats || '0/0',
      creator || 'system',
      create_time || now,
      status || '船未到港',
      shipper || null,
      consignee || null,
      notify_party || null,
      port_of_loading || null,
      port_of_discharge || null,
      place_of_delivery || null,
      transport_method || null,
      company_name || null,
      nextOrderSeq,
      0, // is_void = false
      now,
      now
    )

    const bill = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)

    // 记录操作日志
    logOperation(id, 'create', isDraft ? '创建草稿' : '创建提单', null, bill_number, creator || 'system')

    res.json({
      errCode: 200,
      msg: '创建成功',
      data: convertToCamelCase(bill),
    })
  } catch (error) {
    console.error('创建提单失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建提单失败',
      error: error.message,
    })
  }
})

// 更新提单
app.put('/api/bills/:id', (req, res) => {
  try {
    const { id } = req.params
    const updateData = req.body

    // 检查提单是否存在
    const existing = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({
        errCode: 404,
        msg: '提单不存在',
      })
    }

    // 构建更新语句
    const fields = []
    const values = []

    Object.keys(updateData).forEach((key) => {
      if (key !== 'id' && key !== 'created_at') {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
        fields.push(`${dbKey} = ?`)
        values.push(updateData[key])
      }
    })

    if (fields.length === 0) {
      return res.status(400).json({
        errCode: 400,
        msg: '没有要更新的字段',
      })
    }

    fields.push('updated_at = ?')
    values.push(new Date().toISOString())
    values.push(id)

    const query = `UPDATE bills_of_lading SET ${fields.join(', ')} WHERE id = ?`
    db.prepare(query).run(...values)

    const bill = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)

    res.json({
      errCode: 200,
      msg: '更新成功',
      data: bill,
    })
  } catch (error) {
    console.error('更新提单失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新提单失败',
      error: error.message,
    })
  }
})

// 删除提单
app.delete('/api/bills/:id', (req, res) => {
  try {
    const { id } = req.params

    const result = db.prepare('DELETE FROM bills_of_lading WHERE id = ?').run(id)

    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '提单不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '删除成功',
    })
  } catch (error) {
    console.error('删除提单失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除提单失败',
      error: error.message,
    })
  }
})

// ==================== 查验管理 API ====================

// 获取查验列表（只返回有查验标记的集装箱）
// 注意：此路由已被 orderRoutes 模块处理，此处作为备份
// 订单流转规则: 查验管理显示正在查验流程中的订单，排除已完成派送的订单
app.get('/api/inspections-legacy', (req, res) => {
  try {
    const { status, search, type = 'pending' } = req.query
    
    // 只查询正式订单（排除草稿和作废）
    let query = "SELECT * FROM bills_of_lading WHERE inspection != ? AND status != '草稿' AND (is_void = 0 OR is_void IS NULL)"
    const params = ['-']
    
    // type: pending = 待查验/查验中/已查验/查验放行（正在查验流程中）, released = 已放行
    if (type === 'pending') {
      // 待处理: 排除已完成派送的订单（已送达、已完成）
      query += ' AND inspection IN (?, ?, ?, ?) AND (delivery_status IS NULL OR delivery_status NOT IN (?, ?))'
      params.push('待查验', '查验中', '已查验', '查验放行', '已送达', '已完成')
    } else if (type === 'released') {
      // 已放行: 显示所有已放行的订单（包括历史记录）
      query += ' AND inspection = ?'
      params.push('已放行')
    }
    
    if (status) {
      query += ' AND inspection = ?'
      params.push(status)
    }
    
    if (search) {
      query += ' AND (bill_number LIKE ? OR container_number LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern)
    }
    
    query += ' ORDER BY order_seq DESC, updated_at DESC'
    
    const bills = db.prepare(query).all(...params)
    
    // 统计各状态数量（遵循流转规则）
    const stats = {
      // 待处理: 排除已完成派送的订单
      pending: db.prepare("SELECT COUNT(*) as count FROM bills_of_lading WHERE status != '草稿' AND (is_void = 0 OR is_void IS NULL) AND inspection IN ('待查验', '查验中', '已查验', '查验放行') AND (delivery_status IS NULL OR delivery_status NOT IN ('已送达', '已完成'))").get().count,
      // 已放行
      released: db.prepare("SELECT COUNT(*) as count FROM bills_of_lading WHERE status != '草稿' AND (is_void = 0 OR is_void IS NULL) AND inspection = '已放行'").get().count,
    }
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: {
        list: bills.map(convertToCamelCase),
        total: bills.length,
        stats,
      },
    })
  } catch (error) {
    console.error('获取查验列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取查验列表失败',
      error: error.message,
    })
  }
})

// 更新提单的查验状态（支持完整查验流程）
app.put('/api/bills/:id/inspection', (req, res) => {
  try {
    const { id } = req.params
    const { 
      inspection, 
      inspectionNote,
      inspectionDetail,  // 查验货物详情（JSON数组）
      estimatedTime,     // 预计查验时间
      startTime,         // 实际开始时间
      endTime,           // 实际结束时间
      result,            // 查验结果：pass, second_inspection, fail
      resultNote,        // 结果说明
      releaseTime,       // 放行时间
      confirmedTime      // 确认时间
    } = req.body
    
    // 检查提单是否存在
    const existing = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({
        errCode: 404,
        msg: '提单不存在',
      })
    }
    
    const oldInspection = existing.inspection
    
    // 构建更新语句
    let updateFields = ['inspection = ?', 'updated_at = CURRENT_TIMESTAMP']
    let params = [inspection]
    
    // 更新查验详情
    if (inspectionDetail !== undefined) {
      updateFields.push('inspection_detail = ?')
      params.push(JSON.stringify(inspectionDetail))
    }
    
    // 更新预计查验时间
    if (estimatedTime !== undefined) {
      updateFields.push('inspection_estimated_time = ?')
      params.push(estimatedTime)
    }
    
    // 更新开始时间
    if (startTime !== undefined) {
      updateFields.push('inspection_start_time = ?')
      params.push(startTime)
    }
    
    // 更新结束时间
    if (endTime !== undefined) {
      updateFields.push('inspection_end_time = ?')
      params.push(endTime)
    }
    
    // 更新查验结果
    if (result !== undefined) {
      updateFields.push('inspection_result = ?')
      params.push(result)
    }
    
    // 更新结果说明
    if (resultNote !== undefined) {
      updateFields.push('inspection_result_note = ?')
      params.push(resultNote)
    }
    
    // 更新放行时间
    if (releaseTime !== undefined) {
      updateFields.push('inspection_release_time = ?')
      params.push(releaseTime)
    }
    
    // 更新确认时间
    if (confirmedTime !== undefined) {
      updateFields.push('inspection_confirmed_time = ?')
      params.push(confirmedTime)
    }
    
    params.push(id)
    
    // 执行更新
    db.prepare(`
      UPDATE bills_of_lading 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).run(...params)
    
    // 记录操作日志
    const operationNameMap = {
      '待查验': '标记查验',
      '查验中': '开始查验',
      '已查验': '完成查验',
      '查验放行': '查验放行',
      '已放行': '确认放行',
    }
    logOperation(id, 'inspection', operationNameMap[inspection] || '查验状态变更', oldInspection, inspection, 'admin', inspectionNote || resultNote)
    
    const updated = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    
    res.json({
      errCode: 200,
      msg: '查验状态更新成功',
      data: convertToCamelCase(updated),
    })
  } catch (error) {
    console.error('更新查验状态失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新查验状态失败',
      error: error.message,
    })
  }
})

// ==================== CMR 管理 API ====================

// 获取 CMR 列表（基于派送状态分类）
// 订单流转规则:
// - undelivered（待派送）: 已到港 + 清关放行 + 查验通过（无查验或已放行）+ 派送状态为待派送
// - delivering（派送中）: 派送状态为派送中
// - exception（订单异常）: 派送状态为订单异常或异常关闭
// - archived（已归档）: 派送状态为已送达
app.get('/api/cmr', (req, res) => {
  try {
    const { type = 'undelivered', search } = req.query
    
    // CMR管理只显示正式创建的订单，排除草稿和作废
    let query = "SELECT * FROM bills_of_lading WHERE status != '草稿' AND (is_void = 0 OR is_void IS NULL)"
    const params = []
    
    // 根据类型过滤（按照订单流转规则）
    if (type === 'undelivered') {
      // 待派送: 必须已到港 + 清关放行 + 查验通过（无查验或已放行）+ 派送状态为待派送
      query += ` AND ship_status = '已到港' 
                 AND customs_status = '已放行' 
                 AND (inspection = '-' OR inspection = '已放行' OR inspection IS NULL)
                 AND delivery_status = '待派送'`
    } else if (type === 'delivering') {
      // 派送中
      query += ' AND delivery_status = ?'
      params.push('派送中')
    } else if (type === 'exception') {
      // 订单异常
      query += ' AND delivery_status IN (?, ?)'
      params.push('订单异常', '异常关闭')
    } else if (type === 'archived') {
      // 归档（已送达或已完成）
      query += ' AND delivery_status IN (?, ?)'
      params.push('已送达', '已完成')
    }
    // type === 'all' 时不添加派送状态过滤，但仍排除草稿和作废
    
    // 搜索
    if (search) {
      query += ' AND (bill_number LIKE ? OR container_number LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern)
    }
    
    // 按订单序号降序排序（最新创建的在前）
    query += ' ORDER BY order_seq DESC, create_time DESC'
    
    const bills = db.prepare(query).all(...params)
    
    // 统计各状态数量（按照订单流转规则）
    const stats = {
      // 待派送: 已到港 + 清关放行 + 查验通过 + 待派送
      undelivered: db.prepare(`
        SELECT COUNT(*) as count FROM bills_of_lading 
        WHERE status != '草稿' AND (is_void = 0 OR is_void IS NULL)
        AND ship_status = '已到港' 
        AND customs_status = '已放行' 
        AND (inspection = '-' OR inspection = '已放行' OR inspection IS NULL)
        AND delivery_status = '待派送'
      `).get().count,
      // 派送中
      delivering: db.prepare("SELECT COUNT(*) as count FROM bills_of_lading WHERE status != '草稿' AND (is_void = 0 OR is_void IS NULL) AND delivery_status = '派送中'").get().count,
      // 订单异常
      exception: db.prepare("SELECT COUNT(*) as count FROM bills_of_lading WHERE status != '草稿' AND (is_void = 0 OR is_void IS NULL) AND delivery_status IN ('订单异常', '异常关闭')").get().count,
      // 已归档
      archived: db.prepare("SELECT COUNT(*) as count FROM bills_of_lading WHERE status != '草稿' AND (is_void = 0 OR is_void IS NULL) AND delivery_status IN ('已送达', '已完成')").get().count,
    }
    
    res.json({
      errCode: 200,
      msg: '获取成功',
      data: {
        list: bills.map(convertToCamelCase),
        total: bills.length,
        stats,
      },
    })
  } catch (error) {
    console.error('获取 CMR 列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取 CMR 列表失败',
      error: error.message,
    })
  }
})

// 更新提单的派送状态
app.put('/api/bills/:id/delivery', (req, res) => {
  try {
    const { id } = req.params
    const { 
      deliveryStatus, 
      deliveryNote,
      // CMR详细字段
      cmrDetail,
      cmrEstimatedPickupTime,
      cmrServiceProvider,
      cmrDeliveryAddress,
      cmrEstimatedArrivalTime,
      cmrActualArrivalTime,
      cmrUnloadingCompleteTime,
      cmrConfirmedTime,
      cmrHasException,
      cmrExceptionNote,
      cmrExceptionTime,
      cmrExceptionStatus,
      cmrExceptionRecords,
      cmrNotes,
    } = req.body
    
    // 检查提单是否存在
    const existing = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({
        errCode: 404,
        msg: '提单不存在',
      })
    }
    
    const oldDeliveryStatus = existing.delivery_status
    
    // 构建更新字段
    let updateFields = 'delivery_status = ?, updated_at = CURRENT_TIMESTAMP'
    const updateParams = [deliveryStatus]
    
    if (cmrDetail !== undefined) {
      updateFields += ', cmr_detail = ?'
      updateParams.push(JSON.stringify(cmrDetail))
    }
    if (cmrEstimatedPickupTime !== undefined) {
      updateFields += ', cmr_estimated_pickup_time = ?'
      updateParams.push(cmrEstimatedPickupTime)
    }
    if (cmrServiceProvider !== undefined) {
      updateFields += ', cmr_service_provider = ?'
      updateParams.push(cmrServiceProvider)
    }
    if (cmrDeliveryAddress !== undefined) {
      updateFields += ', cmr_delivery_address = ?'
      updateParams.push(cmrDeliveryAddress)
    }
    if (cmrEstimatedArrivalTime !== undefined) {
      updateFields += ', cmr_estimated_arrival_time = ?'
      updateParams.push(cmrEstimatedArrivalTime)
    }
    if (cmrActualArrivalTime !== undefined) {
      updateFields += ', cmr_actual_arrival_time = ?'
      updateParams.push(cmrActualArrivalTime)
    }
    if (cmrUnloadingCompleteTime !== undefined) {
      updateFields += ', cmr_unloading_complete_time = ?'
      updateParams.push(cmrUnloadingCompleteTime)
    }
    if (cmrConfirmedTime !== undefined) {
      updateFields += ', cmr_confirmed_time = ?'
      updateParams.push(cmrConfirmedTime)
    }
    if (cmrHasException !== undefined) {
      updateFields += ', cmr_has_exception = ?'
      updateParams.push(cmrHasException ? 1 : 0)
    }
    if (cmrExceptionNote !== undefined) {
      updateFields += ', cmr_exception_note = ?'
      updateParams.push(cmrExceptionNote)
    }
    if (cmrExceptionTime !== undefined) {
      updateFields += ', cmr_exception_time = ?'
      updateParams.push(cmrExceptionTime)
    }
    if (cmrExceptionStatus !== undefined) {
      updateFields += ', cmr_exception_status = ?'
      updateParams.push(cmrExceptionStatus)
    }
    if (cmrExceptionRecords !== undefined) {
      updateFields += ', cmr_exception_records = ?'
      updateParams.push(JSON.stringify(cmrExceptionRecords))
    }
    if (cmrNotes !== undefined) {
      updateFields += ', cmr_notes = ?'
      updateParams.push(cmrNotes)
    }
    
    updateParams.push(id)
    
    // 更新派送状态和CMR字段
    db.prepare(`UPDATE bills_of_lading SET ${updateFields} WHERE id = ?`).run(...updateParams)
    
    // 记录操作日志
    const operationNameMap = {
      '待派送': '设为待派送',
      '派送中': '开始派送',
      '已送达': '确认送达',
      '订单异常': '标记订单异常',
      '异常关闭': '关闭异常订单',
    }
    logOperation(id, 'delivery', operationNameMap[deliveryStatus] || '派送状态变更', oldDeliveryStatus, deliveryStatus, 'admin', deliveryNote || cmrExceptionNote)
    
    const updated = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    
    res.json({
      errCode: 200,
      msg: '派送状态更新成功',
      data: convertToCamelCase(updated),
    })
  } catch (error) {
    console.error('更新派送状态失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新派送状态失败',
      error: error.message,
    })
  }
})

// 草稿转正式订单
app.put('/api/bills/:id/publish', (req, res) => {
  try {
    const { id } = req.params
    const { newStatus = '船未到港' } = req.body
    
    // 检查提单是否存在
    const existing = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({
        errCode: 404,
        msg: '草稿不存在',
      })
    }
    
    // 检查是否为草稿
    if (existing.status !== '草稿') {
      return res.status(400).json({
        errCode: 400,
        msg: '只有草稿可以发布为正式订单',
      })
    }
    
    // 获取新的正式订单序号
    const newOrderSeq = getNextOrderSeq('bill')
    
    // 更新状态和序号
    db.prepare(`
      UPDATE bills_of_lading 
      SET status = ?, order_seq = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStatus, newOrderSeq, id)
    
    const updated = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    
    res.json({
      errCode: 200,
      msg: '草稿已发布为正式订单',
      data: convertToCamelCase(updated),
    })
  } catch (error) {
    console.error('发布草稿失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '发布草稿失败',
      error: error.message,
    })
  }
})

// 作废提单
app.put('/api/bills/:id/void', (req, res) => {
  try {
    const { id } = req.params
    const { voidReason } = req.body
    
    // 检查提单是否存在
    const existing = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({
        errCode: 404,
        msg: '提单不存在',
      })
    }
    
    // 检查是否已经作废
    if (existing.is_void === 1) {
      return res.status(400).json({
        errCode: 400,
        msg: '该提单已经作废',
      })
    }
    
    const now = new Date().toISOString()
    
    // 更新为作废状态
    db.prepare(`
      UPDATE bills_of_lading 
      SET is_void = 1, void_reason = ?, void_time = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(voidReason || null, now, id)
    
    // 记录操作日志
    logOperation(id, 'void', '作废订单', '有效', '已作废', 'admin', voidReason)
    
    const updated = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    
    res.json({
      errCode: 200,
      msg: '提单作废成功',
      data: convertToCamelCase(updated),
    })
  } catch (error) {
    console.error('作废提单失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '作废提单失败',
      error: error.message,
    })
  }
})

// 恢复作废的提单
app.put('/api/bills/:id/restore', (req, res) => {
  try {
    const { id } = req.params
    
    // 检查提单是否存在
    const existing = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({
        errCode: 404,
        msg: '提单不存在',
      })
    }
    
    // 检查是否已经作废
    if (existing.is_void !== 1) {
      return res.status(400).json({
        errCode: 400,
        msg: '该提单未作废，无需恢复',
      })
    }
    
    // 恢复提单
    db.prepare(`
      UPDATE bills_of_lading 
      SET is_void = 0, void_reason = NULL, void_time = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id)
    
    // 记录操作日志
    logOperation(id, 'restore', '恢复订单', '已作废', '有效', 'admin')
    
    const updated = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    
    res.json({
      errCode: 200,
      msg: '提单恢复成功',
      data: convertToCamelCase(updated),
    })
  } catch (error) {
    console.error('恢复提单失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '恢复提单失败',
      error: error.message,
    })
  }
})

// 更新船状态
app.put('/api/bills/:id/ship-status', (req, res) => {
  try {
    const { id } = req.params
    const { shipStatus, skipPort, skipPortNote, actualArrivalDate } = req.body
    
    // 检查提单是否存在
    const existing = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({
        errCode: 404,
        msg: '提单不存在',
      })
    }
    
    const oldShipStatus = existing.ship_status || '未到港'
    const now = new Date().toISOString()
    
    // 根据状态更新不同字段
    // 注意：同时更新 ship_status 和 status 字段，保持各页面显示一致
    if (shipStatus === '跳港') {
      // 跳港需要记录跳港目的地和时间
      db.prepare(`
        UPDATE bills_of_lading 
        SET ship_status = ?, skip_port = ?, skip_port_time = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(shipStatus, skipPort || null, now, id)
      
      logOperation(id, 'ship_status', '跳港', oldShipStatus, `跳港至: ${skipPort}`, 'admin', skipPortNote)
    } else if (shipStatus === '已到港') {
      // 已到港需要记录实际到港日期，同时更新 status 字段
      db.prepare(`
        UPDATE bills_of_lading 
        SET ship_status = ?, status = ?, actual_arrival_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(shipStatus, '已到港', actualArrivalDate || now, id)
      
      logOperation(id, 'ship_status', '确认到港', oldShipStatus, `实际到港: ${actualArrivalDate || now}`, 'admin', skipPortNote)
    } else {
      // 未到港，同时更新 status 字段
      db.prepare(`
        UPDATE bills_of_lading 
        SET ship_status = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(shipStatus, '船未到港', id)
      
      logOperation(id, 'ship_status', '设为未到港', oldShipStatus, shipStatus, 'admin', skipPortNote)
    }
    
    const updated = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    
    res.json({
      errCode: 200,
      msg: '船状态更新成功',
      data: convertToCamelCase(updated),
    })
  } catch (error) {
    console.error('更新船状态失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新船状态失败',
      error: error.message,
    })
  }
})

// 更新清关状态
app.put('/api/bills/:id/customs-status', (req, res) => {
  try {
    const { id } = req.params
    const { customsStatus, customsNote } = req.body
    
    // 检查提单是否存在
    const existing = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({
        errCode: 404,
        msg: '提单不存在',
      })
    }
    
    const oldCustomsStatus = existing.customs_status || '未放行'
    const now = new Date().toISOString()
    
    // 更新清关状态
    if (customsStatus === '已放行') {
      db.prepare(`
        UPDATE bills_of_lading 
        SET customs_status = ?, customs_release_time = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(customsStatus, now, id)
      
      logOperation(id, 'customs', '清关放行', oldCustomsStatus, customsStatus, 'admin', customsNote)
    } else {
      db.prepare(`
        UPDATE bills_of_lading 
        SET customs_status = ?, customs_release_time = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(customsStatus, id)
      
      logOperation(id, 'customs', '取消放行', oldCustomsStatus, customsStatus, 'admin', customsNote)
    }
    
    const updated = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    
    res.json({
      errCode: 200,
      msg: '清关状态更新成功',
      data: convertToCamelCase(updated),
    })
  } catch (error) {
    console.error('更新清关状态失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新清关状态失败',
      error: error.message,
    })
  }
})

// 获取最近活动（系统概览用）
app.get('/api/recent-activities', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10
    
    // 获取最近的操作日志
    const activities = await db.prepare(`
      SELECT 
        ol.id,
        ol.bill_id,
        ol.operation_type,
        ol.operation_name,
        ol.old_value,
        ol.new_value,
        ol.operator,
        ol.operation_time,
        ol.module,
        b.bill_number
      FROM operation_logs ol
      LEFT JOIN bills_of_lading b ON ol.bill_id = b.id
      ORDER BY ol.operation_time DESC
      LIMIT ?
    `).all(limit)
    
    // 转换为前端需要的格式
    const formattedActivities = activities.map(a => {
      const time = a.operation_time ? new Date(a.operation_time) : new Date()
      const now = new Date()
      const diffMs = now.getTime() - time.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMins / 60)
      const diffDays = Math.floor(diffHours / 24)
      
      let timeStr = ''
      if (diffMins < 1) timeStr = '刚刚'
      else if (diffMins < 60) timeStr = `${diffMins}分钟前`
      else if (diffHours < 24) timeStr = `${diffHours}小时前`
      else if (diffDays < 7) timeStr = `${diffDays}天前`
      else timeStr = time.toLocaleDateString('zh-CN')
      
      return {
        id: String(a.id),
        type: a.module || a.operation_type || 'order',
        action: a.operation_name || '操作',
        description: a.bill_number ? `提单 ${a.bill_number}` : `订单 ${a.bill_id}`,
        time: timeStr,
        operator: a.operator || '系统'
      }
    })
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: formattedActivities
    })
  } catch (error) {
    console.error('获取最近活动失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取最近活动失败',
      error: error.message
    })
  }
})

// 标记提单为已完成
app.put('/api/bills/:id/complete', async (req, res) => {
  try {
    const { id } = req.params
    const { completeNote } = req.body
    
    // 检查提单是否存在
    const existing = await db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({
        errCode: 404,
        msg: '提单不存在',
      })
    }
    
    // 只有已送达的提单才能标记为已完成
    if (existing.delivery_status !== '已送达') {
      return res.status(400).json({
        errCode: 400,
        msg: '只有已送达的提单才能标记为已完成',
      })
    }
    
    const oldStatus = existing.status
    const now = new Date().toISOString()
    
    // 更新状态为已完成
    await db.prepare(`
      UPDATE bills_of_lading 
      SET status = ?, complete_time = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run('已完成', now, id)
    
    await logOperation(id, 'complete', '标记完成', oldStatus, '已完成', 'admin', completeNote)
    
    const updated = await db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
    
    res.json({
      errCode: 200,
      msg: '提单已标记为完成',
      data: convertToCamelCase(updated),
    })
  } catch (error) {
    console.error('标记完成失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '标记完成失败',
      error: error.message,
    })
  }
})

// ==================== 文件管理 API ====================

// 获取提单文件列表
app.get('/api/bills/:id/files', (req, res) => {
  try {
    const { id } = req.params
    
    const files = db.prepare(`
      SELECT id, bill_id, file_name, original_size, compressed_size, file_type, upload_by, upload_time
      FROM bill_files 
      WHERE bill_id = ?
      ORDER BY upload_time DESC
    `).all(id)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: files.map(f => ({
        id: f.id,
        billId: f.bill_id,
        fileName: f.file_name,
        originalSize: f.original_size,
        compressedSize: f.compressed_size,
        fileType: f.file_type,
        uploadBy: f.upload_by,
        uploadTime: f.upload_time,
      })),
    })
  } catch (error) {
    console.error('获取文件列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取文件列表失败',
      error: error.message,
    })
  }
})

// 上传文件（带压缩）
app.post('/api/bills/:id/files', upload.single('file'), (req, res) => {
  try {
    const { id } = req.params
    const file = req.file
    
    if (!file) {
      return res.status(400).json({
        errCode: 400,
        msg: '请选择要上传的文件',
      })
    }
    
    // 解码文件名（处理中文等非ASCII字符）
    const originalFileName = decodeFileName(file.originalname)
    
    // 读取原始文件
    const originalData = readFileSync(file.path)
    const originalSize = originalData.length
    
    // 使用 gzip 压缩
    const compressedData = zlib.gzipSync(originalData, { level: 9 })
    const compressedSize = compressedData.length
    
    // 保存压缩后的文件（使用唯一ID作为文件名）
    const compressedDir = join(__dirname, 'uploads', 'compressed')
    const compressedFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.gz`
    const compressedPath = join(compressedDir, compressedFileName)
    writeFileSync(compressedPath, compressedData)
    
    // 删除原始上传文件
    try {
      unlinkSync(file.path)
    } catch (e) {
      console.error('删除临时文件失败:', e)
    }
    
    // 保存到数据库（使用解码后的文件名）
    const now = new Date().toISOString()
    const result = db.prepare(`
      INSERT INTO bill_files (bill_id, file_name, file_path, original_size, compressed_size, file_type, upload_by, upload_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, originalFileName, compressedPath, originalSize, compressedSize, file.mimetype, 'admin', now)
    
    // 记录操作日志
    logOperation(id, 'file', '上传文件', null, originalFileName, 'admin', `原始: ${originalSize} 字节, 压缩后: ${compressedSize} 字节`)
    
    res.json({
      errCode: 200,
      msg: '文件上传成功',
      data: {
        id: result.lastInsertRowid,
        billId: id,
        fileName: originalFileName,
        originalSize,
        compressedSize,
        fileType: file.mimetype,
        uploadBy: 'admin',
        uploadTime: now,
      },
    })
  } catch (error) {
    console.error('上传文件失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '上传文件失败',
      error: error.message,
    })
  }
})

// 下载文件（解压缩恢复原始大小）
app.get('/api/bills/:billId/files/:fileId/download', (req, res) => {
  try {
    const { billId, fileId } = req.params
    
    const file = db.prepare(`
      SELECT * FROM bill_files WHERE id = ? AND bill_id = ?
    `).get(fileId, billId)
    
    if (!file) {
      return res.status(404).json({
        errCode: 404,
        msg: '文件不存在',
      })
    }
    
    // 检查压缩文件是否存在
    if (!existsSync(file.file_path)) {
      return res.status(404).json({
        errCode: 404,
        msg: '文件已被删除',
      })
    }
    
    // 读取压缩文件
    const compressedData = readFileSync(file.file_path)
    
    // 解压缩恢复原始数据
    const originalData = zlib.gunzipSync(compressedData)
    
    // 记录操作日志
    logOperation(billId, 'file', '下载文件', null, file.file_name, 'admin', '')
    
    // 设置响应头并发送文件
    res.setHeader('Content-Type', file.file_type)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name)}`)
    res.setHeader('Content-Length', originalData.length)
    res.send(originalData)
  } catch (error) {
    console.error('下载文件失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '下载文件失败',
      error: error.message,
    })
  }
})

// 删除文件
app.delete('/api/bills/:billId/files/:fileId', (req, res) => {
  try {
    const { billId, fileId } = req.params
    
    const file = db.prepare(`
      SELECT * FROM bill_files WHERE id = ? AND bill_id = ?
    `).get(fileId, billId)
    
    if (!file) {
      return res.status(404).json({
        errCode: 404,
        msg: '文件不存在',
      })
    }
    
    // 删除压缩文件
    try {
      if (existsSync(file.file_path)) {
        unlinkSync(file.file_path)
      }
    } catch (e) {
      console.error('删除压缩文件失败:', e)
    }
    
    // 从数据库删除记录
    db.prepare('DELETE FROM bill_files WHERE id = ?').run(fileId)
    
    // 记录操作日志
    logOperation(billId, 'file', '删除文件', file.file_name, null, 'admin', '')
    
    res.json({
      errCode: 200,
      msg: '文件已删除',
    })
  } catch (error) {
    console.error('删除文件失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除文件失败',
      error: error.message,
    })
  }
})

// ==================== 序号管理 API ====================

// 获取所有业务类型的序号统计
app.get('/api/sequences/stats', (req, res) => {
  try {
    const sequences = db.prepare(`SELECT * FROM order_sequences ORDER BY business_type`).all()
    
    // 获取每个业务类型的订单统计
    const stats = sequences.map(seq => {
      let tableName = ''
      switch (seq.business_type) {
        case 'package': tableName = 'packages'; break
        case 'bill': tableName = 'bills_of_lading'; break
        case 'declaration': tableName = 'declarations'; break
        case 'label': tableName = 'labels'; break
        case 'last_mile': tableName = 'last_mile_orders'; break
        default: tableName = null
      }
      
      let orderStats = { total: 0, valid: 0, void: 0 }
      if (tableName) {
        try {
          const statsResult = db.prepare(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN is_void = 0 OR is_void IS NULL THEN 1 ELSE 0 END) as valid,
              SUM(CASE WHEN is_void = 1 THEN 1 ELSE 0 END) as void
            FROM ${tableName}
          `).get()
          orderStats = statsResult || orderStats
        } catch (e) {
          // 表可能不存在
        }
      }
      
      return {
        businessType: seq.business_type,
        currentSeq: seq.current_seq,
        prefix: seq.prefix,
        description: seq.description,
        updatedAt: seq.updated_at,
        stats: {
          total: orderStats.total || 0,
          valid: orderStats.valid || 0,
          void: orderStats.void || 0,
        }
      }
    })
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: stats,
    })
  } catch (error) {
    console.error('获取序号统计失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取序号统计失败',
      error: error.message,
    })
  }
})

// 获取指定业务类型的序号信息
app.get('/api/sequences/:businessType', (req, res) => {
  try {
    const { businessType } = req.params
    const seqInfo = db.prepare(`SELECT * FROM order_sequences WHERE business_type = ?`).get(businessType)
    
    if (!seqInfo) {
      return res.status(404).json({
        errCode: 404,
        msg: '业务类型不存在',
      })
    }
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        businessType: seqInfo.business_type,
        currentSeq: seqInfo.current_seq,
        prefix: seqInfo.prefix,
        description: seqInfo.description,
        nextSeq: seqInfo.current_seq + 1,
        nextFormatted: `${seqInfo.prefix}${String(seqInfo.current_seq + 1).padStart(6, '0')}`,
      },
    })
  } catch (error) {
    console.error('获取序号信息失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取序号信息失败',
      error: error.message,
    })
  }
})

// ==================== 基础数据管理 API ====================

// 获取基础数据列表
app.get('/api/basic-data', (req, res) => {
  try {
    const { category, status, search } = req.query
    let query = 'SELECT * FROM basic_data WHERE 1=1'
    const params = []

    if (category) {
      query += ' AND category = ?'
      params.push(category)
    }

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    if (search) {
      query += ' AND (name LIKE ? OR code LIKE ? OR description LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern)
    }

    query += ' ORDER BY created_at DESC'

    const data = db.prepare(query).all(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: data.map(item => ({
        id: String(item.id),
        name: item.name,
        code: item.code,
        category: item.category,
        description: item.description || '',
        status: item.status,
        createTime: item.created_at,
        updateTime: item.updated_at,
      })),
    })
  } catch (error) {
    console.error('获取基础数据列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取基础数据列表失败',
    })
  }
})

// 获取基础数据分类列表 (静态路由必须在动态路由 :id 之前)
app.get('/api/basic-data/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT DISTINCT category 
      FROM basic_data 
      ORDER BY category
    `).all()
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: categories.map(item => item.category),
    })
  } catch (error) {
    console.error('获取分类列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取分类列表失败',
    })
  }
})

// 获取基础数据详情
app.get('/api/basic-data/:id', (req, res) => {
  try {
    const { id } = req.params
    const data = db.prepare('SELECT * FROM basic_data WHERE id = ?').get(id)
    
    if (!data) {
      return res.status(404).json({
        errCode: 404,
        msg: '基础数据不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: String(data.id),
        name: data.name,
        code: data.code,
        category: data.category,
        description: data.description || '',
        status: data.status,
        createTime: data.created_at,
        updateTime: data.updated_at,
      },
    })
  } catch (error) {
    console.error('获取基础数据详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取基础数据详情失败',
    })
  }
})

// 创建基础数据
app.post('/api/basic-data', (req, res) => {
  try {
    const { name, code, category, description, status = 'active' } = req.body

    if (!name || !code || !category) {
      return res.status(400).json({
        errCode: 400,
        msg: '名称、代码和分类为必填项',
      })
    }

    // 检查代码是否已存在
    const existing = db.prepare('SELECT * FROM basic_data WHERE code = ?').get(code)
    if (existing) {
      return res.status(400).json({
        errCode: 400,
        msg: '代码已存在',
      })
    }

    const result = db.prepare(`
      INSERT INTO basic_data (name, code, category, description, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, code, category, description || '', status)

    res.json({
      errCode: 200,
      msg: '创建成功',
      data: {
        id: String(result.lastInsertRowid),
        name,
        code,
        category,
        description: description || '',
        status,
      },
    })
  } catch (error) {
    console.error('创建基础数据失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建基础数据失败',
    })
  }
})

// 更新基础数据
app.put('/api/basic-data/:id', (req, res) => {
  try {
    const { id } = req.params
    const { name, code, category, description, status } = req.body

    if (!name || !code || !category) {
      return res.status(400).json({
        errCode: 400,
        msg: '名称、代码和分类为必填项',
      })
    }

    // 检查代码是否被其他记录使用
    const existing = db.prepare('SELECT * FROM basic_data WHERE code = ? AND id != ?').get(code, id)
    if (existing) {
      return res.status(400).json({
        errCode: 400,
        msg: '代码已被其他记录使用',
      })
    }

    db.prepare(`
      UPDATE basic_data 
      SET name = ?, code = ?, category = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, code, category, description || '', status || 'active', id)

    res.json({
      errCode: 200,
      msg: '更新成功',
    })
  } catch (error) {
    console.error('更新基础数据失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新基础数据失败',
    })
  }
})

// 删除基础数据
app.delete('/api/basic-data/:id', (req, res) => {
  try {
    const { id } = req.params
    
    const result = db.prepare('DELETE FROM basic_data WHERE id = ?').run(id)
    
    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '基础数据不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '删除成功',
    })
  } catch (error) {
    console.error('删除基础数据失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除基础数据失败',
    })
  }
})

// ==================== 集装箱代码管理 API ====================

// 获取集装箱代码列表（用于管理）
app.get('/api/container-codes', (req, res) => {
  try {
    const { companyCode, search, includeLeasing } = req.query
    let query = `
      SELECT cc.id, cc.container_code, cc.description, cc.created_at, cc.updated_at,
             sc.id as shipping_company_id, sc.company_name, sc.company_code
      FROM container_codes cc
      LEFT JOIN shipping_companies sc ON cc.shipping_company_id = sc.id
      WHERE 1=1
    `
    const params = []

    if (companyCode) {
      query += ' AND sc.company_code = ?'
      params.push(companyCode)
    }
    
    // 如果不包含租赁公司代码，则只返回有船公司关联的代码
    if (includeLeasing !== 'true' && !search) {
      // 默认不过滤，返回所有代码
    }

    if (search) {
      query += ' AND (cc.container_code LIKE ? OR COALESCE(sc.company_name, cc.description) LIKE ? OR sc.company_code LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern)
    }

    query += " ORDER BY COALESCE(sc.company_name, 'zzz租赁公司'), cc.container_code"

    const data = db.prepare(query).all(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: data.map(item => ({
        id: String(item.id),
        containerCode: item.container_code,
        description: item.description || '',
        companyName: item.company_name || '租赁公司',
        companyCode: item.company_code || 'LEASING',
        shippingCompanyId: item.shipping_company_id ? String(item.shipping_company_id) : null,
        createTime: item.created_at,
        updateTime: item.updated_at,
      })),
    })
  } catch (error) {
    console.error('获取集装箱代码列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取集装箱代码列表失败',
    })
  }
})

// 获取集装箱代码详情
app.get('/api/container-codes/:id', (req, res) => {
  try {
    const { id } = req.params
    const data = db.prepare(`
      SELECT cc.id, cc.container_code, cc.description, cc.created_at, cc.updated_at,
             sc.id as shipping_company_id, sc.company_name, sc.company_code
      FROM container_codes cc
      JOIN shipping_companies sc ON cc.shipping_company_id = sc.id
      WHERE cc.id = ?
    `).get(id)
    
    if (!data) {
      return res.status(404).json({
        errCode: 404,
        msg: '集装箱代码不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: String(data.id),
        containerCode: data.container_code,
        description: data.description || '',
        companyName: data.company_name,
        companyCode: data.company_code,
        shippingCompanyId: String(data.shipping_company_id),
        createTime: data.created_at,
        updateTime: data.updated_at,
      },
    })
  } catch (error) {
    console.error('获取集装箱代码详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取集装箱代码详情失败',
    })
  }
})

// 创建集装箱代码
app.post('/api/container-codes', (req, res) => {
  try {
    const { containerCode, description, shippingCompanyId } = req.body

    if (!containerCode || !shippingCompanyId) {
      return res.status(400).json({
        errCode: 400,
        msg: '集装箱代码和海运公司为必填项',
      })
    }

    // 检查代码是否已存在
    const existing = db.prepare(`
      SELECT * FROM container_codes 
      WHERE shipping_company_id = ? AND container_code = ?
    `).get(shippingCompanyId, containerCode.toUpperCase())
    
    if (existing) {
      return res.status(400).json({
        errCode: 400,
        msg: '该海运公司的集装箱代码已存在',
      })
    }

    const result = db.prepare(`
      INSERT INTO container_codes (shipping_company_id, container_code, description)
      VALUES (?, ?, ?)
    `).run(shippingCompanyId, containerCode.toUpperCase(), description || '')

    res.json({
      errCode: 200,
      msg: '创建成功',
      data: {
        id: String(result.lastInsertRowid),
        containerCode: containerCode.toUpperCase(),
        description: description || '',
        shippingCompanyId,
      },
    })
  } catch (error) {
    console.error('创建集装箱代码失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建集装箱代码失败',
    })
  }
})

// 更新集装箱代码
app.put('/api/container-codes/:id', (req, res) => {
  try {
    const { id } = req.params
    const { containerCode, description, shippingCompanyId } = req.body

    if (!containerCode || !shippingCompanyId) {
      return res.status(400).json({
        errCode: 400,
        msg: '集装箱代码和海运公司为必填项',
      })
    }

    // 检查代码是否被其他记录使用
    const existing = db.prepare(`
      SELECT * FROM container_codes 
      WHERE shipping_company_id = ? AND container_code = ? AND id != ?
    `).get(shippingCompanyId, containerCode.toUpperCase(), id)
    
    if (existing) {
      return res.status(400).json({
        errCode: 400,
        msg: '该海运公司的集装箱代码已被其他记录使用',
      })
    }

    db.prepare(`
      UPDATE container_codes 
      SET container_code = ?, description = ?, shipping_company_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(containerCode.toUpperCase(), description || '', shippingCompanyId, id)

    res.json({
      errCode: 200,
      msg: '更新成功',
    })
  } catch (error) {
    console.error('更新集装箱代码失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新集装箱代码失败',
    })
  }
})

// 删除集装箱代码
app.delete('/api/container-codes/:id', (req, res) => {
  try {
    const { id } = req.params
    
    const result = db.prepare('DELETE FROM container_codes WHERE id = ?').run(id)
    
    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '集装箱代码不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '删除成功',
    })
  } catch (error) {
    console.error('删除集装箱代码失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除集装箱代码失败',
    })
  }
})

// ==================== 提单文件解析 API ====================

// 解析提单文件（提取信息）
app.post('/api/bills/parse-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        errCode: 400,
        msg: '请上传文件',
      })
    }

    const file = req.file
    const filePath = file.path
    const fileType = file.mimetype

    console.log('收到文件解析请求:', file.originalname, '类型:', fileType, '路径:', filePath)

    let extractedData = {}

    try {
      if (fileType === 'application/pdf') {
        // PDF文件处理
        console.log('开始解析PDF文件:', filePath)
        if (!existsSync(filePath)) {
          throw new Error('文件不存在: ' + filePath)
        }
        
        const dataBuffer = readFileSync(filePath)
        const pdfData = await pdfParse(dataBuffer)
        const text = pdfData.text
        
        console.log('PDF文本内容长度:', text.length)
        console.log('PDF文本前500字符:', text.substring(0, 500))
        
        // 从PDF文本中提取信息
        extractedData = extractDataFromText(text, file.originalname)
      } else if (fileType.startsWith('image/')) {
        // 图片文件处理（需要OCR）
        // TODO: 使用OCR库（如Tesseract.js）提取文本
        // 目前从文件名提取
        console.log('图片文件，从文件名提取信息:', file.originalname)
        extractedData = extractDataFromText('', file.originalname)
      } else {
        // 其他文件类型，从文件名提取
        console.log('其他文件类型，从文件名提取信息:', file.originalname)
        extractedData = extractDataFromText('', file.originalname)
      }

      console.log('提取的数据:', extractedData)

      res.json({
        errCode: 200,
        msg: '解析成功',
        data: extractedData,
      })
    } catch (parseError) {
      console.error('解析文件失败:', parseError)
      console.error('错误堆栈:', parseError.stack)
      res.status(500).json({
        errCode: 500,
        msg: '解析文件失败: ' + (parseError.message || '未知错误'),
        error: parseError.message,
      })
    }
  } catch (error) {
    console.error('处理文件上传失败:', error)
    console.error('错误堆栈:', error.stack)
    res.status(500).json({
      errCode: 500,
      msg: '处理文件上传失败: ' + (error.message || '未知错误'),
      error: error.message,
    })
  }
})

// ==================== 起运港管理 API ====================

// 获取起运港列表
app.get('/api/ports-of-loading', (req, res) => {
  try {
    const { country, status, search, transportType, continent } = req.query
    
    // 如果需要按洲过滤，需要关联countries表
    let query = ''
    if (continent) {
      query = `
        SELECT DISTINCT p.* 
        FROM ports_of_loading p
        LEFT JOIN countries c ON p.country = c.country_name_cn OR p.country_code = c.country_code
        WHERE 1=1
      `
    } else {
      query = 'SELECT * FROM ports_of_loading WHERE 1=1'
    }
    const params = []

    if (continent) {
      query += ' AND c.continent = ?'
      params.push(continent)
    }

    if (country) {
      query += ' AND p.country = ?'
      params.push(country)
    }

    if (status) {
      query += continent ? ' AND p.status = ?' : ' AND status = ?'
      params.push(status)
    }

    if (transportType) {
      query += continent ? ' AND p.transport_type = ?' : ' AND transport_type = ?'
      params.push(transportType)
    }

    if (search) {
      if (continent) {
        query += ' AND (p.port_code LIKE ? OR p.port_name_cn LIKE ? OR p.port_name_en LIKE ? OR p.city LIKE ?)'
      } else {
        query += ' AND (port_code LIKE ? OR port_name_cn LIKE ? OR port_name_en LIKE ? OR city LIKE ?)'
      }
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern, searchPattern)
    }

    query += continent ? ' ORDER BY p.country, p.port_name_cn' : ' ORDER BY country, port_name_cn'

    const data = db.prepare(query).all(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: data.map(item => ({
        id: String(item.id),
        portCode: item.port_code,
        portNameCn: item.port_name_cn,
        portNameEn: item.port_name_en || '',
        country: item.country || '',
        countryCode: item.country_code || '',
        city: item.city || '',
        description: item.description || '',
        transportType: item.transport_type || 'sea',
        portType: item.port_type || 'main',
        parentPortCode: item.parent_port_code || undefined,
        status: item.status,
        createTime: item.created_at,
        updateTime: item.updated_at,
      })),
    })
  } catch (error) {
    console.error('获取起运港列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取起运港列表失败',
    })
  }
})

// 获取主港口列表 (静态路由必须在动态路由 :id 之前)
app.get('/api/ports-of-loading/main-ports', (req, res) => {
  try {
    const { transportType = 'sea' } = req.query
    
    let query = 'SELECT * FROM ports_of_loading WHERE port_type = ?'
    const params = ['main']
    
    if (transportType) {
      query += ' AND transport_type = ?'
      params.push(transportType)
    }
    
    query += ' ORDER BY port_name_cn'
    
    const data = db.prepare(query).all(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: data.map((item) => ({
        id: String(item.id),
        portCode: item.port_code,
        portNameCn: item.port_name_cn,
        portNameEn: item.port_name_en || '',
        country: item.country || '',
        countryCode: item.country_code || '',
        city: item.city || '',
        description: item.description || '',
        transportType: item.transport_type || 'sea',
        portType: item.port_type || 'main',
        parentPortCode: item.parent_port_code || undefined,
        status: item.status,
        createTime: item.created_at,
        updateTime: item.updated_at,
      })),
    })
  } catch (error) {
    console.error('获取主港口列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取主港口列表失败',
    })
  }
})

// 获取起运港国家列表 (静态路由必须在动态路由 :id 之前)
app.get('/api/ports-of-loading/countries', (req, res) => {
  try {
    const countries = db.prepare(`
      SELECT DISTINCT country, country_code 
      FROM ports_of_loading 
      WHERE country IS NOT NULL AND country != ''
      ORDER BY country
    `).all()
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: countries.map(item => ({
        country: item.country,
        countryCode: item.country_code || '',
      })),
    })
  } catch (error) {
    console.error('获取国家列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取国家列表失败',
    })
  }
})

// 获取起运港详情
app.get('/api/ports-of-loading/:id', (req, res) => {
  try {
    const { id } = req.params
    const data = db.prepare('SELECT * FROM ports_of_loading WHERE id = ?').get(id)
    
    if (!data) {
      return res.status(404).json({
        errCode: 404,
        msg: '起运港不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: String(data.id),
        portCode: data.port_code,
        portNameCn: data.port_name_cn,
        portNameEn: data.port_name_en || '',
        country: data.country || '',
        countryCode: data.country_code || '',
        city: data.city || '',
        description: data.description || '',
        transportType: data.transport_type || 'sea',
        portType: data.port_type || 'main',
        parentPortCode: data.parent_port_code || undefined,
        status: data.status,
        createTime: data.created_at,
        updateTime: data.updated_at,
      },
    })
  } catch (error) {
    console.error('获取起运港详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取起运港详情失败',
    })
  }
})

// 创建起运港
app.post('/api/ports-of-loading', (req, res) => {
  try {
    const { portCode, portNameCn, portNameEn, country, countryCode, city, description, transportType = 'sea', portType = 'main', parentPortCode, status = 'active' } = req.body

    if (!portCode || !portNameCn) {
      return res.status(400).json({
        errCode: 400,
        msg: '港口代码和中文名称为必填项',
      })
    }

    // 检查代码是否已存在
    const existing = db.prepare('SELECT * FROM ports_of_loading WHERE port_code = ?').get(portCode.toUpperCase())
    if (existing) {
      return res.status(400).json({
        errCode: 400,
        msg: '港口代码已存在',
      })
    }

    const result = db.prepare(`
      INSERT INTO ports_of_loading (port_code, port_name_cn, port_name_en, country, country_code, city, description, transport_type, port_type, parent_port_code, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      portCode.toUpperCase(),
      portNameCn,
      portNameEn || '',
      country || '',
      countryCode || '',
      city || '',
      description || '',
      transportType || 'sea',
      portType || 'main',
      parentPortCode || null,
      status
    )

    res.json({
      errCode: 200,
      msg: '创建成功',
      data: {
        id: String(result.lastInsertRowid),
        portCode: portCode.toUpperCase(),
        portNameCn,
        portNameEn: portNameEn || '',
        country: country || '',
        countryCode: countryCode || '',
        city: city || '',
        description: description || '',
        transportType: transportType || 'sea',
        portType: portType || 'main',
        parentPortCode: parentPortCode || undefined,
        status,
      },
    })
  } catch (error) {
    console.error('创建起运港失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建起运港失败',
    })
  }
})

// 更新起运港
app.put('/api/ports-of-loading/:id', (req, res) => {
  try {
    const { id } = req.params
    const { portCode, portNameCn, portNameEn, country, countryCode, city, description, transportType = 'sea', portType = 'main', parentPortCode, status } = req.body

    if (!portCode || !portNameCn) {
      return res.status(400).json({
        errCode: 400,
        msg: '港口代码和中文名称为必填项',
      })
    }

    // 检查代码是否被其他记录使用
    const existing = db.prepare('SELECT * FROM ports_of_loading WHERE port_code = ? AND id != ?').get(portCode.toUpperCase(), id)
    if (existing) {
      return res.status(400).json({
        errCode: 400,
        msg: '港口代码已被其他记录使用',
      })
    }

    db.prepare(`
      UPDATE ports_of_loading 
      SET port_code = ?, port_name_cn = ?, port_name_en = ?, country = ?, country_code = ?, city = ?, description = ?, transport_type = ?, port_type = ?, parent_port_code = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      portCode.toUpperCase(),
      portNameCn,
      portNameEn || '',
      country || '',
      countryCode || '',
      city || '',
      description || '',
      transportType || 'sea',
      portType || 'main',
      parentPortCode || null,
      status || 'active',
      id
    )

    res.json({
      errCode: 200,
      msg: '更新成功',
    })
  } catch (error) {
    console.error('更新起运港失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新起运港失败',
    })
  }
})

// 删除起运港
app.delete('/api/ports-of-loading/:id', (req, res) => {
  try {
    const { id } = req.params
    
    const result = db.prepare('DELETE FROM ports_of_loading WHERE id = ?').run(id)
    
    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '起运港不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '删除成功',
    })
  } catch (error) {
    console.error('删除起运港失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除起运港失败',
    })
  }
})

// 清空所有起运港数据
app.delete('/api/ports-of-loading', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM ports_of_loading').run()
    
    res.json({
      errCode: 200,
      msg: '清空成功',
      data: {
        deletedCount: result.changes,
      },
    })
    console.log(`已清空所有起运港数据，共删除 ${result.changes} 条记录`)
  } catch (error) {
    console.error('清空起运港数据失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '清空起运港数据失败',
    })
  }
})

// ==================== 目的港管理 API ====================

// 获取目的港列表
app.get('/api/destination-ports', (req, res) => {
  try {
    const { country, status, search, transportType, continent } = req.query
    let query = 'SELECT * FROM destination_ports WHERE 1=1'
    const params = []

    if (transportType) {
      query += ' AND transport_type = ?'
      params.push(transportType)
    }

    if (continent) {
      query += ' AND continent = ?'
      params.push(continent)
    }

    if (country) {
      query += ' AND country = ?'
      params.push(country)
    }

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    if (search) {
      query += ' AND (port_code LIKE ? OR port_name_cn LIKE ? OR port_name_en LIKE ? OR city LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern, searchPattern)
    }

    query += ' ORDER BY continent, country, port_name_cn'

    const data = db.prepare(query).all(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: data.map(item => ({
        id: String(item.id),
        portCode: item.port_code,
        portNameCn: item.port_name_cn,
        portNameEn: item.port_name_en || '',
        country: item.country || '',
        countryCode: item.country_code || '',
        city: item.city || '',
        transportType: item.transport_type || 'sea',
        continent: item.continent || '亚洲',
        description: item.description || '',
        status: item.status,
        createTime: item.created_at,
        updateTime: item.updated_at,
      })),
    })
  } catch (error) {
    console.error('获取目的港列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取目的港列表失败',
    })
  }
})

// 获取目的港国家列表 (静态路由必须在动态路由 :id 之前)
app.get('/api/destination-ports/countries', (req, res) => {
  try {
    const countries = db.prepare(`
      SELECT DISTINCT country, country_code 
      FROM destination_ports 
      WHERE country IS NOT NULL AND country != ''
      ORDER BY country
    `).all()
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: countries.map(item => ({
        country: item.country,
        countryCode: item.country_code || '',
      })),
    })
  } catch (error) {
    console.error('获取国家列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取国家列表失败',
    })
  }
})

// 获取目的港详情
app.get('/api/destination-ports/:id', (req, res) => {
  try {
    const { id } = req.params
    const data = db.prepare('SELECT * FROM destination_ports WHERE id = ?').get(id)
    
    if (!data) {
      return res.status(404).json({
        errCode: 404,
        msg: '目的港不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: String(data.id),
        portCode: data.port_code,
        portNameCn: data.port_name_cn,
        portNameEn: data.port_name_en || '',
        country: data.country || '',
        countryCode: data.country_code || '',
        city: data.city || '',
        transportType: data.transport_type || 'sea',
        continent: data.continent || '亚洲',
        description: data.description || '',
        status: data.status,
        createTime: data.created_at,
        updateTime: data.updated_at,
      },
    })
  } catch (error) {
    console.error('获取目的港详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取目的港详情失败',
    })
  }
})

// 创建目的港
app.post('/api/destination-ports', (req, res) => {
  try {
    const { portCode, portNameCn, portNameEn, country, countryCode, city, transportType = 'sea', continent = '亚洲', description, status = 'active' } = req.body

    if (!portCode || !portNameCn) {
      return res.status(400).json({
        errCode: 400,
        msg: '港口代码和中文名称为必填项',
      })
    }

    // 检查代码是否已存在
    const existing = db.prepare('SELECT * FROM destination_ports WHERE port_code = ?').get(portCode.toUpperCase())
    if (existing) {
      return res.status(400).json({
        errCode: 400,
        msg: '港口代码已存在',
      })
    }

    const result = db.prepare(`
      INSERT INTO destination_ports (port_code, port_name_cn, port_name_en, country, country_code, city, transport_type, continent, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      portCode.toUpperCase(),
      portNameCn,
      portNameEn || '',
      country || '',
      countryCode || '',
      city || '',
      transportType,
      continent,
      description || '',
      status
    )

    res.json({
      errCode: 200,
      msg: '创建成功',
      data: {
        id: String(result.lastInsertRowid),
        portCode: portCode.toUpperCase(),
        portNameCn,
        portNameEn: portNameEn || '',
        country: country || '',
        countryCode: countryCode || '',
        city: city || '',
        transportType,
        continent,
        description: description || '',
        status,
      },
    })
  } catch (error) {
    console.error('创建目的港失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建目的港失败',
    })
  }
})

// 更新目的港
app.put('/api/destination-ports/:id', (req, res) => {
  try {
    const { id } = req.params
    const { portCode, portNameCn, portNameEn, country, countryCode, city, transportType, continent, description, status } = req.body

    if (!portCode || !portNameCn) {
      return res.status(400).json({
        errCode: 400,
        msg: '港口代码和中文名称为必填项',
      })
    }

    // 检查代码是否被其他记录使用
    const existing = db.prepare('SELECT * FROM destination_ports WHERE port_code = ? AND id != ?').get(portCode.toUpperCase(), id)
    if (existing) {
      return res.status(400).json({
        errCode: 400,
        msg: '港口代码已被其他记录使用',
      })
    }

    db.prepare(`
      UPDATE destination_ports 
      SET port_code = ?, port_name_cn = ?, port_name_en = ?, country = ?, country_code = ?, city = ?, transport_type = ?, continent = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      portCode.toUpperCase(),
      portNameCn,
      portNameEn || '',
      country || '',
      countryCode || '',
      city || '',
      transportType || 'sea',
      continent || '亚洲',
      description || '',
      status || 'active',
      id
    )

    res.json({
      errCode: 200,
      msg: '更新成功',
    })
  } catch (error) {
    console.error('更新目的港失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新目的港失败',
    })
  }
})

// 删除目的港
app.delete('/api/destination-ports/:id', (req, res) => {
  try {
    const { id } = req.params
    
    const result = db.prepare('DELETE FROM destination_ports WHERE id = ?').run(id)
    
    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '目的港不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '删除成功',
    })
  } catch (error) {
    console.error('删除目的港失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除目的港失败',
    })
  }
})

// ==================== 空运港管理 API ====================

// 获取空运港列表
app.get('/api/air-ports', (req, res) => {
  try {
    const { country, status, search, continent } = req.query
    
    // 如果需要按洲过滤，需要关联countries表
    let query = ''
    if (continent) {
      query = `
        SELECT DISTINCT a.* 
        FROM air_ports a
        LEFT JOIN countries c ON a.country = c.country_name_cn OR a.country_code = c.country_code
        WHERE 1=1
      `
    } else {
      query = 'SELECT * FROM air_ports WHERE 1=1'
    }
    const params = []

    if (continent) {
      query += ' AND c.continent = ?'
      params.push(continent)
    }

    if (country) {
      query += continent ? ' AND a.country = ?' : ' AND country = ?'
      params.push(country)
    }

    if (status) {
      query += continent ? ' AND a.status = ?' : ' AND status = ?'
      params.push(status)
    }

    if (search) {
      if (continent) {
        query += ' AND (a.port_code LIKE ? OR a.port_name_cn LIKE ? OR a.port_name_en LIKE ? OR a.city LIKE ? OR a.country LIKE ?)'
      } else {
        query += ' AND (port_code LIKE ? OR port_name_cn LIKE ? OR port_name_en LIKE ? OR city LIKE ? OR country LIKE ?)'
      }
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern)
    }

    query += continent ? ' ORDER BY a.country, a.port_name_cn' : ' ORDER BY country, port_name_cn'

    const data = db.prepare(query).all(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: data.map(item => ({
        id: String(item.id),
        portCode: item.port_code,
        portNameCn: item.port_name_cn,
        portNameEn: item.port_name_en || '',
        country: item.country || '',
        countryCode: item.country_code || '',
        city: item.city || '',
        description: item.description || '',
        status: item.status,
        createTime: item.created_at,
        updateTime: item.updated_at,
      })),
    })
  } catch (error) {
    console.error('获取空运港列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取空运港列表失败',
    })
  }
})

// 获取空运港国家列表 (静态路由必须在动态路由 :id 之前)
app.get('/api/air-ports/countries', (req, res) => {
  try {
    const countries = db.prepare(`
      SELECT DISTINCT country, country_code 
      FROM air_ports 
      WHERE country IS NOT NULL AND country != ''
      ORDER BY country
    `).all()
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: countries.map(item => ({
        country: item.country,
        countryCode: item.country_code || '',
      })),
    })
  } catch (error) {
    console.error('获取国家列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取国家列表失败',
    })
  }
})

// 获取空运港详情
app.get('/api/air-ports/:id', (req, res) => {
  try {
    const { id } = req.params
    const data = db.prepare('SELECT * FROM air_ports WHERE id = ?').get(id)
    
    if (!data) {
      return res.status(404).json({
        errCode: 404,
        msg: '空运港不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: String(data.id),
        portCode: data.port_code,
        portNameCn: data.port_name_cn,
        portNameEn: data.port_name_en || '',
        country: data.country || '',
        countryCode: data.country_code || '',
        city: data.city || '',
        description: data.description || '',
        status: data.status,
        createTime: data.created_at,
        updateTime: data.updated_at,
      },
    })
  } catch (error) {
    console.error('获取空运港详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取空运港详情失败',
    })
  }
})

// 创建空运港
app.post('/api/air-ports', (req, res) => {
  try {
    const { portCode, portNameCn, portNameEn, country, countryCode, city, description, status = 'active' } = req.body

    if (!portCode || !portNameCn) {
      return res.status(400).json({
        errCode: 400,
        msg: '港口代码和中文名称为必填项',
      })
    }

    // 检查代码是否已存在
    const existing = db.prepare('SELECT * FROM air_ports WHERE port_code = ?').get(portCode.toUpperCase())
    if (existing) {
      return res.status(400).json({
        errCode: 400,
        msg: '港口代码已存在',
      })
    }

    const result = db.prepare(`
      INSERT INTO air_ports (port_code, port_name_cn, port_name_en, country, country_code, city, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      portCode.toUpperCase(),
      portNameCn,
      portNameEn || '',
      country || '',
      countryCode || '',
      city || '',
      description || '',
      status
    )

    res.json({
      errCode: 200,
      msg: '创建成功',
      data: {
        id: String(result.lastInsertRowid),
        portCode: portCode.toUpperCase(),
        portNameCn,
        portNameEn: portNameEn || '',
        country: country || '',
        countryCode: countryCode || '',
        city: city || '',
        description: description || '',
        status,
      },
    })
  } catch (error) {
    console.error('创建空运港失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建空运港失败',
    })
  }
})

// 更新空运港
app.put('/api/air-ports/:id', (req, res) => {
  try {
    const { id } = req.params
    const { portCode, portNameCn, portNameEn, country, countryCode, city, description, status = 'active' } = req.body

    if (!portCode || !portNameCn) {
      return res.status(400).json({
        errCode: 400,
        msg: '港口代码和中文名称为必填项',
      })
    }

    // 检查代码是否被其他记录使用
    const existing = db.prepare('SELECT * FROM air_ports WHERE port_code = ? AND id != ?').get(portCode.toUpperCase(), id)
    if (existing) {
      return res.status(400).json({
        errCode: 400,
        msg: '港口代码已被其他记录使用',
      })
    }

    db.prepare(`
      UPDATE air_ports 
      SET port_code = ?, port_name_cn = ?, port_name_en = ?, country = ?, country_code = ?, city = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      portCode.toUpperCase(),
      portNameCn,
      portNameEn || '',
      country || '',
      countryCode || '',
      city || '',
      description || '',
      status || 'active',
      id
    )

    res.json({
      errCode: 200,
      msg: '更新成功',
    })
  } catch (error) {
    console.error('更新空运港失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新空运港失败',
    })
  }
})

// 删除空运港
app.delete('/api/air-ports/:id', (req, res) => {
  try {
    const { id } = req.params
    
    const result = db.prepare('DELETE FROM air_ports WHERE id = ?').run(id)
    
    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '空运港不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '删除成功',
    })
  } catch (error) {
    console.error('删除空运港失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除空运港失败',
    })
  }
})

// ==================== 国家管理 API ====================

// 获取国家列表
app.get('/api/countries', async (req, res) => {
  try {
    const { continent, status, search } = req.query
    let query = 'SELECT * FROM countries WHERE 1=1'
    const params = []

    if (continent) {
      query += ' AND continent = ?'
      params.push(continent)
    }

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    if (search) {
      query += ' AND (country_code LIKE ? OR country_name_cn LIKE ? OR country_name_en LIKE ? OR capital LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern, searchPattern)
    }

    query += ' ORDER BY continent, country_name_cn'

    const data = await db.prepare(query).all(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: data.map(item => ({
        id: String(item.id),
        countryCode: item.country_code,
        countryNameCn: item.country_name_cn,
        countryNameEn: item.country_name_en,
        continent: item.continent || '',
        region: item.region || '',
        capital: item.capital || '',
        currencyCode: item.currency_code || '',
        currencyName: item.currency_name || '',
        phoneCode: item.phone_code || '',
        timezone: item.timezone || '',
        description: item.description || '',
        status: item.status,
        createTime: item.created_at,
        updateTime: item.updated_at,
      })),
    })
  } catch (error) {
    console.error('获取国家列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取国家列表失败',
    })
  }
})

// 获取国家大洲列表 (静态路由必须在动态路由 :id 之前)
app.get('/api/countries/continents', (req, res) => {
  try {
    const continents = db.prepare(`
      SELECT DISTINCT continent 
      FROM countries 
      WHERE continent IS NOT NULL AND continent != ''
      ORDER BY continent
    `).all()
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: continents.map(item => item.continent),
    })
  } catch (error) {
    console.error('获取大洲列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取大洲列表失败',
    })
  }
})

// 获取国家详情
app.get('/api/countries/:id', (req, res) => {
  try {
    const { id } = req.params
    const data = db.prepare('SELECT * FROM countries WHERE id = ?').get(id)
    
    if (!data) {
      return res.status(404).json({
        errCode: 404,
        msg: '国家不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: String(data.id),
        countryCode: data.country_code,
        countryNameCn: data.country_name_cn,
        countryNameEn: data.country_name_en,
        continent: data.continent || '',
        region: data.region || '',
        capital: data.capital || '',
        currencyCode: data.currency_code || '',
        currencyName: data.currency_name || '',
        phoneCode: data.phone_code || '',
        timezone: data.timezone || '',
        description: data.description || '',
        status: data.status,
        createTime: data.created_at,
        updateTime: data.updated_at,
      },
    })
  } catch (error) {
    console.error('获取国家详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取国家详情失败',
    })
  }
})

// 创建国家
app.post('/api/countries', (req, res) => {
  try {
    const { countryCode, countryNameCn, countryNameEn, continent, region, capital, currencyCode, currencyName, phoneCode, timezone, description, status = 'active' } = req.body

    if (!countryCode || !countryNameCn || !countryNameEn) {
      return res.status(400).json({
        errCode: 400,
        msg: '国家代码、中文名称和英文名称为必填项',
      })
    }

    // 检查代码是否已存在
    const existing = db.prepare('SELECT * FROM countries WHERE country_code = ?').get(countryCode.toUpperCase())
    if (existing) {
      return res.status(400).json({
        errCode: 400,
        msg: '国家代码已存在',
      })
    }

    const result = db.prepare(`
      INSERT INTO countries (country_code, country_name_cn, country_name_en, continent, region, capital, currency_code, currency_name, phone_code, timezone, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      countryCode.toUpperCase(),
      countryNameCn,
      countryNameEn,
      continent || '',
      region || '',
      capital || '',
      currencyCode || '',
      currencyName || '',
      phoneCode || '',
      timezone || '',
      description || '',
      status
    )

    res.json({
      errCode: 200,
      msg: '创建成功',
      data: {
        id: String(result.lastInsertRowid),
        countryCode: countryCode.toUpperCase(),
        countryNameCn,
        countryNameEn,
        continent: continent || '',
        region: region || '',
        capital: capital || '',
        currencyCode: currencyCode || '',
        currencyName: currencyName || '',
        phoneCode: phoneCode || '',
        timezone: timezone || '',
        description: description || '',
        status,
      },
    })
  } catch (error) {
    console.error('创建国家失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建国家失败',
    })
  }
})

// 更新国家
app.put('/api/countries/:id', (req, res) => {
  try {
    const { id } = req.params
    const { countryCode, countryNameCn, countryNameEn, continent, region, capital, currencyCode, currencyName, phoneCode, timezone, description, status } = req.body

    if (!countryCode || !countryNameCn || !countryNameEn) {
      return res.status(400).json({
        errCode: 400,
        msg: '国家代码、中文名称和英文名称为必填项',
      })
    }

    // 检查代码是否被其他记录使用
    const existing = db.prepare('SELECT * FROM countries WHERE country_code = ? AND id != ?').get(countryCode.toUpperCase(), id)
    if (existing) {
      return res.status(400).json({
        errCode: 400,
        msg: '国家代码已被其他记录使用',
      })
    }

    db.prepare(`
      UPDATE countries 
      SET country_code = ?, country_name_cn = ?, country_name_en = ?, continent = ?, region = ?, capital = ?, currency_code = ?, currency_name = ?, phone_code = ?, timezone = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      countryCode.toUpperCase(),
      countryNameCn,
      countryNameEn,
      continent || '',
      region || '',
      capital || '',
      currencyCode || '',
      currencyName || '',
      phoneCode || '',
      timezone || '',
      description || '',
      status || 'active',
      id
    )

    res.json({
      errCode: 200,
      msg: '更新成功',
    })
  } catch (error) {
    console.error('更新国家失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新国家失败',
    })
  }
})

// 删除国家
app.delete('/api/countries/:id', (req, res) => {
  try {
    const { id } = req.params
    
    const result = db.prepare('DELETE FROM countries WHERE id = ?').run(id)
    
    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '国家不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '删除成功',
    })
  } catch (error) {
    console.error('删除国家失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除国家失败',
    })
  }
})

// ==================== 城市 API ====================

// 根据国家获取城市列表
app.get('/api/cities/country/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params
    const { search } = req.query
    
    let query = 'SELECT * FROM cities WHERE country_code = ? AND status = ?'
    const queryParams = [countryCode.toUpperCase(), 'active']
    
    if (search) {
      query += ' AND (city_name_cn LIKE ? OR city_name_en LIKE ?)'
      const searchPattern = `%${search}%`
      queryParams.push(searchPattern, searchPattern)
    }
    
    query += ' ORDER BY level, city_name_cn LIMIT 100'
    
    const cities = await db.prepare(query).all(...queryParams)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: cities.map(row => ({
        id: row.id,
        countryCode: row.country_code,
        cityCode: row.city_code,
        cityNameCn: row.city_name_cn,
        cityNameEn: row.city_name_en,
        parentId: row.parent_id,
        level: row.level,
        postalCode: row.postal_code,
        status: row.status
      }))
    })
  } catch (error) {
    console.error('获取城市列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取城市列表失败'
    })
  }
})

// 获取城市列表
app.get('/api/cities', async (req, res) => {
  try {
    const { countryCode, parentId, level, status = 'active', search } = req.query
    
    let query = 'SELECT * FROM cities WHERE 1=1'
    const queryParams = []
    
    if (status) {
      query += ' AND status = ?'
      queryParams.push(status)
    }
    
    if (countryCode) {
      query += ' AND country_code = ?'
      queryParams.push(countryCode.toUpperCase())
    }
    
    if (parentId !== undefined) {
      query += ' AND parent_id = ?'
      queryParams.push(parseInt(parentId))
    }
    
    if (level) {
      query += ' AND level = ?'
      queryParams.push(parseInt(level))
    }
    
    if (search) {
      query += ' AND (city_name_cn LIKE ? OR city_name_en LIKE ?)'
      const searchPattern = `%${search}%`
      queryParams.push(searchPattern, searchPattern)
    }
    
    query += ' ORDER BY level, city_name_cn LIMIT 500'
    
    const cities = await db.prepare(query).all(...queryParams)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: cities.map(row => ({
        id: row.id,
        countryCode: row.country_code,
        cityCode: row.city_code,
        cityNameCn: row.city_name_cn,
        cityNameEn: row.city_name_en,
        parentId: row.parent_id,
        level: row.level,
        postalCode: row.postal_code,
        status: row.status
      }))
    })
  } catch (error) {
    console.error('获取城市列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取城市列表失败'
    })
  }
})

// 从文本中提取提单信息
function extractDataFromText(text, fileName) {
  const extracted = {}
  const upperText = text.toUpperCase()
  const upperFileName = fileName.toUpperCase()
  
  console.log('开始从文本提取信息，文本长度:', text.length, '文件名:', fileName)
  
  // 1. 提取主单号（格式：4个字母+数字，如 EMCU1608836, COSU1234567）
  const billNumberPatterns = [
    /([A-Z]{4}\d{7,})/g,  // 4字母+7位以上数字
    /(B\/L\s*NO[:\s]*([A-Z]{4}\d+))/i,  // B/L NO: EMCU1608836
    /(BILL\s*OF\s*LADING[:\s]*([A-Z]{4}\d+))/i,  // BILL OF LADING: EMCU1608836
  ]
  
  for (const pattern of billNumberPatterns) {
    const match = upperText.match(pattern) || upperFileName.match(pattern)
    if (match) {
      const numberMatch = match[0].match(/([A-Z]{4}\d+)/)
      if (numberMatch) {
        extracted.masterBillNumber = numberMatch[1]
        console.log('找到主单号:', extracted.masterBillNumber)
        break
      }
    }
  }
  
  // 如果文本中没有找到，从文件名中提取
  if (!extracted.masterBillNumber) {
    const fileNameMatch = upperFileName.match(/([A-Z]{4}\d{7,})/)
    if (fileNameMatch) {
      extracted.masterBillNumber = fileNameMatch[1]
      console.log('从文件名找到主单号:', extracted.masterBillNumber)
    }
  }
  
  // 2. 提取集装箱号码
  const containerPattern = /([A-Z]{4}[UJZ]\d{6,7})/g
  const containerMatch = upperText.match(containerPattern) || upperFileName.match(containerPattern)
  if (containerMatch) {
    extracted.containerNumber = containerMatch[0]
    console.log('找到集装箱号:', extracted.containerNumber)
  }
  
  // 3. 提取船名/航班号（优先匹配 "6. Ocean Vessel Voy. No." 字段）
  const vesselPatterns = [
    // 优先匹配 "6. Ocean Vessel Voy. No." 或 "Ocean Vessel Voy. No." 字段
    // 支持多种格式：6. Ocean Vessel Voy. No., 6. OCEAN VESSEL VOY. NO., Ocean Vessel Voy. No. 等
    /(?:6\.\s*)?OCEAN\s*VESSEL\s*VOY\.?\s*NO\.?[:\s]+([A-Z0-9\s\-\.\/]+?)(?:\n|$|(?=\d+\.\s*[A-Z]))/i,
    /(?:6\.\s*)?OCEAN\s*VESSEL\s*VOY\.?\s*NO\.?[:\s]+([^\n\r]{1,50})/i,
    // 其他常见格式
    /(VESSEL|VESSEL\s*NAME)[:\s]+([A-Z\s]+)/i,
    /(FLIGHT\s*NO|FLIGHT)[:\s]+([A-Z0-9]+)/i,
  ]
  for (const pattern of vesselPatterns) {
    const match = text.match(pattern)
    if (match) {
      // 对于 "Ocean Vessel Voy. No." 模式，值在第一个捕获组
      // 对于其他模式，值在第二个捕获组
      const vesselValue = match[1] || match[2]
      if (vesselValue) {
        extracted.vessel = vesselValue.trim()
        console.log('找到船名/航班号 (Ocean Vessel Voy. No.):', extracted.vessel)
        break
      }
    }
  }
  
  // 4. 提取起运港（优先匹配 "7. Port of Loading" 字段）
  const originPatterns = [
    // 优先匹配 "7. Port of Loading" 或 "Port of Loading" 字段
    /(?:7\.\s*)?PORT\s*OF\s*LOADING[:\s]+([A-Z][A-Za-z\s,]+?)(?:\n|$|(?=\d+\.\s*[A-Z]))/i,
    /(?:7\.\s*)?PORT\s*OF\s*LOADING[:\s]+([^\n\r]{1,50})/i,
    // 其他常见格式
    /(FROM|ORIGIN|POL)[:\s]*([A-Z]{3,5})/i,
    /(SHIP\s*FROM|LOADING\s*PORT)[:\s]*([A-Z\s]+)/i,
  ]
  for (const pattern of originPatterns) {
    const match = text.match(pattern)
    if (match) {
      // 对于 "Port of Loading" 模式，值在第一个捕获组
      // 对于其他模式，值在第二个捕获组
      const originValue = match[1] || match[2]
      if (originValue) {
        extracted.origin = originValue.trim()
        console.log('找到起运港 (Port of Loading):', extracted.origin)
        break
      }
    }
  }
  
  // 5. 提取目的港（优先匹配 "8. Port of Discharge" 字段）
  const destPatterns = [
    // 优先匹配 "8. Port of Discharge" 或 "Port of Discharge" 字段
    /(?:8\.\s*)?PORT\s*OF\s*DISCHARGE[:\s]+([A-Z][A-Za-z\s,]+?)(?:\n|$|(?=\d+\.\s*[A-Z]))/i,
    /(?:8\.\s*)?PORT\s*OF\s*DISCHARGE[:\s]+([^\n\r]{1,50})/i,
    // 其他常见格式
    /(TO|DESTINATION|POD)[:\s]*([A-Z]{3,5})/i,
    /(SHIP\s*TO|DISCHARGE\s*PORT)[:\s]*([A-Z\s]+)/i,
  ]
  for (const pattern of destPatterns) {
    const match = text.match(pattern)
    if (match) {
      // 对于 "Port of Discharge" 模式，值在第一个捕获组
      // 对于其他模式，值在第二个捕获组
      const destValue = match[1] || match[2]
      if (destValue) {
        extracted.destination = destValue.trim()
        console.log('找到目的港 (Port of Discharge):', extracted.destination)
        break
      }
    }
  }
  
  // 6. 提取件数（优先匹配 "No. of Container or Packages" 字段）
  const piecesPatterns = [
    // 优先匹配 "No. of Container or Packages" 或 "No. of Containers or Packages" 字段
    /NO\.?\s*OF\s*CONTAINER[S]?\s*(?:OR|AND)?\s*PACKAGE[S]?[:\s]+(\d+)/i,
    /NO\.?\s*OF\s*(?:CONTAINER[S]?|PACKAGE[S]?)[:\s]+(\d+)/i,
    // 匹配数字后面跟着 PACKAGES 或 PKGS
    /(\d+)\s*(?:PACKAGES?|PKGS?|PCS|PIECES)/i,
    // 其他常见格式
    /(PIECES|PCS|PKGS|PACKAGES)[:\s]*(\d+)/i,
  ]
  for (const pattern of piecesPatterns) {
    const match = text.match(pattern)
    if (match) {
      // 根据模式不同，数字可能在第一个或第二个捕获组
      const piecesValue = match[1] && /^\d+$/.test(match[1]) ? match[1] : match[2]
      if (piecesValue) {
        extracted.pieces = piecesValue
        console.log('找到件数 (No. of Container or Packages):', extracted.pieces)
        break
      }
    }
  }
  
  // 7. 提取毛重（优先匹配 "Gross Weight" 字段）
  const weightPatterns = [
    // 优先匹配 "Gross Weight" 字段，支持多种格式
    /GROSS\s*WEIGHT[:\s]+(\d+[\.,]?\d*)\s*(?:KGS?|KG|TONS?|LBS?)?/i,
    /GROSS\s*WEIGHT[:\s]*[\n\r\s]*(\d+[\.,]?\d*)/i,
    // 匹配数字后面跟着 KGS 等单位
    /(\d+[\.,]?\d*)\s*(?:KGS?|KG)\s*(?:GROSS)?/i,
    // 其他常见格式
    /(G\.?W\.?|WEIGHT)[:\s]*(\d+[\.,]?\d*)\s*(?:KGS?|KG|TONS?)?/i,
  ]
  for (const pattern of weightPatterns) {
    const match = text.match(pattern)
    if (match) {
      // 根据模式不同，数字可能在第一个或第二个捕获组
      let weightValue = match[1]
      if (weightValue && !/^\d/.test(weightValue) && match[2]) {
        weightValue = match[2]
      }
      if (weightValue && /^\d/.test(weightValue)) {
        // 处理逗号作为小数点的情况
        extracted.weight = weightValue.replace(',', '.')
        console.log('找到毛重 (Gross Weight):', extracted.weight)
        break
      }
    }
  }
  
  // 8. 提取体积（优先匹配 "Measurement" 字段）
  const volumePatterns = [
    // 优先匹配 "Measurement" 字段
    /MEASUREMENT[:\s]+(\d+[\.,]?\d*)\s*(?:CBM|M3|CUBIC)?/i,
    /MEASUREMENT[:\s]*[\n\r\s]*(\d+[\.,]?\d*)/i,
    // 其他常见格式
    /(VOLUME|CBM|CUBIC)[:\s]*(\d+[\.,]?\d*)/i,
    /(\d+[\.,]?\d*)\s*(CBM|M3|CUBIC)/i,
  ]
  for (const pattern of volumePatterns) {
    const match = text.match(pattern)
    if (match) {
      // 根据模式不同，数字可能在第一个或第二个捕获组
      let volumeValue = match[1]
      if (volumeValue && !/^\d/.test(volumeValue) && match[2]) {
        volumeValue = match[2]
      }
      if (volumeValue && /^\d/.test(volumeValue)) {
        // 处理逗号作为小数点的情况
        extracted.volume = volumeValue.replace(',', '.')
        console.log('找到体积 (Measurement):', extracted.volume)
        break
      }
    }
  }
  
  // 9. 提取装船日期（Date Laden on Board）
  const dateLadenPatterns = [
    // 优先匹配 "Date Laden on Board" 字段
    /(?:DATE\s*)?LADEN\s*ON\s*BOARD[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:DATE\s*)?LADEN\s*ON\s*BOARD[:\s]+([A-Z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
    /(?:DATE\s*)?LADEN\s*ON\s*BOARD[:\s]+(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i,
    // 其他常见格式
    /(ON\s*BOARD\s*DATE|LADING\s*DATE|SHIPPED\s*ON\s*BOARD)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(ON\s*BOARD\s*DATE|LADING\s*DATE|SHIPPED\s*ON\s*BOARD)[:\s]+([A-Z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
  ]
  
  for (const pattern of dateLadenPatterns) {
    const match = text.match(pattern)
    if (match) {
      const dateValue = (match[1] || match[2]).trim()
      if (dateValue) {
        // 尝试解析日期并格式化为 YYYY-MM-DD
        const formattedDate = parseDate(dateValue)
        if (formattedDate) {
          extracted.estimatedDeparture = formattedDate
          console.log('找到装船日期 (Date Laden on Board):', dateValue, '->', formattedDate)
          break
        }
      }
    }
  }
  
  // 10. 提取海运公司（从常见公司名称）
  const shippingCompanies = [
    'COSCO', 'MSC', 'MAERSK', 'CMA CGM', 'HAPAG-LLOYD', 'EVERGREEN', 'ONE',
    'YANG MING', 'OOCL', 'ZIM', 'HAMBURG SUD', 'PIL', 'WAN HAI', 'KMTC',
    'SITC', 'SINOKOR', 'K LINE', 'NYK', 'MOL'
  ]
  for (const company of shippingCompanies) {
    if (upperText.includes(company.toUpperCase()) || upperFileName.includes(company.toUpperCase())) {
      extracted.shippingCompany = company
      console.log('找到海运公司:', extracted.shippingCompany)
      break
    }
  }
  
  console.log('提取完成，结果:', extracted)
  return extracted
}

// 解析日期字符串并格式化为 YYYY-MM-DD
function parseDate(dateStr) {
  if (!dateStr) return null
  
  try {
    // 处理各种日期格式
    let date
    
    // 格式1: MM/DD/YYYY 或 DD/MM/YYYY
    if (dateStr.match(/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/)) {
      const parts = dateStr.split(/[\/\-\.]/)
      if (parts.length === 3) {
        let month, day, year
        // 判断是 MM/DD/YYYY 还是 DD/MM/YYYY
        if (parseInt(parts[0]) > 12) {
          // DD/MM/YYYY
          day = parseInt(parts[0])
          month = parseInt(parts[1])
          year = parseInt(parts[2])
        } else {
          // MM/DD/YYYY
          month = parseInt(parts[0])
          day = parseInt(parts[1])
          year = parseInt(parts[2])
        }
        // 处理两位年份
        if (year < 100) {
          year = year < 50 ? 2000 + year : 1900 + year
        }
        date = new Date(year, month - 1, day)
      }
    }
    // 格式2: YYYY-MM-DD
    else if (dateStr.match(/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/)) {
      const parts = dateStr.split(/[\/\-\.]/)
      if (parts.length === 3) {
        date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      }
    }
    // 格式3: 英文月份格式 (如 "JAN 15, 2024" 或 "January 15, 2024")
    else if (dateStr.match(/^[A-Z]{3,9}\s+\d{1,2},?\s+\d{4}$/i)) {
      date = new Date(dateStr)
    }
    // 格式4: 标准日期字符串
    else {
      date = new Date(dateStr)
    }
    
    // 验证日期是否有效
    if (date && !isNaN(date.getTime())) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  } catch (error) {
    console.error('解析日期失败:', dateStr, error)
  }
  
  return null
}

// ==================== 服务费类别 API ====================

// 获取所有服务费类别
app.get('/api/service-fee-categories', async (req, res) => {
  try {
    const { search, status } = req.query
    let query = 'SELECT * FROM service_fee_categories WHERE 1=1'
    const params = []

    if (search) {
      query += ' AND (name LIKE ? OR code LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern)
    }

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    query += ' ORDER BY sort_order, name'

    const categories = await db.prepare(query).all(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: categories.map(c => ({
        id: String(c.id),
        name: c.name,
        code: c.code,
        description: c.description,
        sortOrder: c.sort_order,
        status: c.status,
        createTime: c.created_at,
      })),
    })
  } catch (error) {
    console.error('获取服务费类别失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取服务费类别失败',
      error: error.message,
    })
  }
})

// 获取启用的服务费类别名称列表
app.get('/api/service-fee-categories/names', async (req, res) => {
  try {
    const categories = await db.prepare(
      'SELECT name FROM service_fee_categories WHERE status = ? ORDER BY sort_order'
    ).all('active')
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: categories.map(c => c.name),
    })
  } catch (error) {
    console.error('获取服务费类别名称失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取服务费类别名称失败',
      error: error.message,
    })
  }
})

// 创建服务费类别
app.post('/api/service-fee-categories', (req, res) => {
  try {
    const { name, code, description, sortOrder, status } = req.body

    if (!name || !code) {
      return res.status(400).json({
        errCode: 400,
        msg: '类别名称和代码是必填项',
      })
    }

    const result = db.prepare(`
      INSERT INTO service_fee_categories (name, code, description, sort_order, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, code.toUpperCase(), description || '', sortOrder || 0, status || 'active')

    res.json({
      errCode: 200,
      msg: '创建成功',
      data: { id: String(result.lastInsertRowid) },
    })
  } catch (error) {
    console.error('创建服务费类别失败:', error)
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res.status(400).json({
        errCode: 400,
        msg: '类别代码已存在',
      })
    }
    res.status(500).json({
      errCode: 500,
      msg: '创建服务费类别失败',
      error: error.message,
    })
  }
})

// 更新服务费类别
app.put('/api/service-fee-categories/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, code, description, sortOrder, status } = req.body

    const result = await db.prepare(`
      UPDATE service_fee_categories 
      SET name = ?, code = ?, description = ?, sort_order = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, code?.toUpperCase(), description, sortOrder, status, id)

    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '类别不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '更新成功',
    })
  } catch (error) {
    console.error('更新服务费类别失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新服务费类别失败',
      error: error.message,
    })
  }
})

// 删除服务费类别
app.delete('/api/service-fee-categories/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await db.prepare('DELETE FROM service_fee_categories WHERE id = ?').run(id)

    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '类别不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '删除成功',
    })
  } catch (error) {
    console.error('删除服务费类别失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除服务费类别失败',
      error: error.message,
    })
  }
})

// ==================== 服务费项目 API ====================

// 获取所有服务费项目
app.get('/api/service-fees', async (req, res) => {
  try {
    const { search, category } = req.query
    let query = 'SELECT * FROM service_fees WHERE 1=1'
    const params = []

    if (search) {
      query += ' AND (name LIKE ? OR category LIKE ? OR description LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern)
    }

    if (category) {
      query += ' AND category = ?'
      params.push(category)
    }

    query += ' ORDER BY category, name'

    const fees = await db.prepare(query).all(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: fees.map(f => ({
        id: String(f.id),
        name: f.name,
        category: f.category,
        unit: f.unit,
        price: f.price,
        currency: f.currency,
        description: f.description,
        isActive: f.is_active === 1,
      })),
    })
  } catch (error) {
    console.error('获取服务费项目失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取服务费项目失败',
      error: error.message,
    })
  }
})

// 创建服务费项目
app.post('/api/service-fees', async (req, res) => {
  try {
    const { name, category, unit, price, currency, description, isActive } = req.body

    if (!name || !category || !unit || price === undefined) {
      return res.status(400).json({
        errCode: 400,
        msg: '名称、类别、单位和价格是必填项',
      })
    }

    const result = await db.prepare(`
      INSERT INTO service_fees (name, category, unit, price, currency, description, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, category, unit, price, currency || 'EUR', description || '', isActive !== false ? 1 : 0)

    res.json({
      errCode: 200,
      msg: '创建成功',
      data: { id: String(result.lastInsertRowid) },
    })
  } catch (error) {
    console.error('创建服务费项目失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建服务费项目失败',
      error: error.message,
    })
  }
})

// 更新服务费项目
app.put('/api/service-fees/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, category, unit, price, currency, description, isActive } = req.body

    const result = await db.prepare(`
      UPDATE service_fees 
      SET name = ?, category = ?, unit = ?, price = ?, currency = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, category, unit, price, currency, description, isActive ? 1 : 0, id)

    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '项目不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '更新成功',
    })
  } catch (error) {
    console.error('更新服务费项目失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新服务费项目失败',
      error: error.message,
    })
  }
})

// 删除服务费项目
app.delete('/api/service-fees/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await db.prepare('DELETE FROM service_fees WHERE id = ?').run(id)

    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '项目不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '删除成功',
    })
  } catch (error) {
    console.error('删除服务费项目失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除服务费项目失败',
      error: error.message,
    })
  }
})

// ==================== 运输价格 API ====================

// 获取所有运输价格
app.get('/api/transport-prices', async (req, res) => {
  try {
    const { search, origin, destination } = req.query
    let query = 'SELECT * FROM transport_prices WHERE 1=1'
    const params = []

    if (search) {
      query += ' AND (name LIKE ? OR origin LIKE ? OR destination LIKE ? OR description LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern, searchPattern)
    }

    if (origin) {
      query += ' AND origin = ?'
      params.push(origin)
    }

    if (destination) {
      query += ' AND destination = ?'
      params.push(destination)
    }

    query += ' ORDER BY name'

    const prices = await db.prepare(query).all(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: prices.map(p => ({
        id: String(p.id),
        name: p.name,
        origin: p.origin,
        destination: p.destination,
        transportType: p.transport_type,
        distance: p.distance || p.price_per_cbm || 0,
        pricePerKm: p.price_per_km || p.price_per_kg || 0,
        totalPrice: p.total_price || p.min_charge || 0,
        currency: p.currency,
        validFrom: p.valid_from,
        validTo: p.valid_to,
        description: p.description,
        isActive: p.is_active === 1,
      })),
    })
  } catch (error) {
    console.error('获取运输价格失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取运输价格失败',
      error: error.message,
    })
  }
})

// 创建运输价格
app.post('/api/transport-prices', async (req, res) => {
  try {
    const { name, origin, destination, transportType, distance, pricePerKm, totalPrice, currency, validFrom, validTo, description, isActive } = req.body

    if (!name || !origin || !destination) {
      return res.status(400).json({
        errCode: 400,
        msg: '名称、起运地和目的地是必填项',
      })
    }

    // 计算：如果有公里数和公里单价，计算运输总价；如果有公里数和运输总价，反推公里单价
    let finalDistance = Number(distance) || 0
    let finalPricePerKm = Number(pricePerKm) || 0
    let finalTotalPrice = Number(totalPrice) || 0
    
    if (finalDistance > 0 && finalPricePerKm > 0 && finalTotalPrice === 0) {
      finalTotalPrice = finalDistance * finalPricePerKm
    } else if (finalDistance > 0 && finalTotalPrice > 0 && finalPricePerKm === 0) {
      finalPricePerKm = finalTotalPrice / finalDistance
    }

    const result = await db.prepare(`
      INSERT INTO transport_prices (name, origin, destination, transport_type, distance, price_per_km, total_price, currency, valid_from, valid_to, description, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, origin, destination, transportType || '卡车', finalDistance, finalPricePerKm, finalTotalPrice, currency || 'EUR', validFrom || '', validTo || '', description || '', isActive !== false ? 1 : 0)

    res.json({
      errCode: 200,
      msg: '创建成功',
      data: { id: String(result.lastInsertRowid) },
    })
  } catch (error) {
    console.error('创建运输价格失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建运输价格失败',
      error: error.message,
    })
  }
})

// 更新运输价格
app.put('/api/transport-prices/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, origin, destination, transportType, distance, pricePerKm, totalPrice, currency, validFrom, validTo, description, isActive } = req.body

    // 计算：如果有公里数和公里单价，计算运输总价；如果有公里数和运输总价，反推公里单价
    let finalDistance = Number(distance) || 0
    let finalPricePerKm = Number(pricePerKm) || 0
    let finalTotalPrice = Number(totalPrice) || 0
    
    if (finalDistance > 0 && finalPricePerKm > 0 && finalTotalPrice === 0) {
      finalTotalPrice = finalDistance * finalPricePerKm
    } else if (finalDistance > 0 && finalTotalPrice > 0 && finalPricePerKm === 0) {
      finalPricePerKm = finalTotalPrice / finalDistance
    }

    const result = await db.prepare(`
      UPDATE transport_prices 
      SET name = ?, origin = ?, destination = ?, transport_type = ?, distance = ?, price_per_km = ?, total_price = ?, currency = ?, valid_from = ?, valid_to = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, origin, destination, transportType, finalDistance, finalPricePerKm, finalTotalPrice, currency, validFrom, validTo, description, isActive ? 1 : 0, id)

    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '价格不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '更新成功',
    })
  } catch (error) {
    console.error('更新运输价格失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新运输价格失败',
      error: error.message,
    })
  }
})

// 删除运输价格
app.delete('/api/transport-prices/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await db.prepare('DELETE FROM transport_prices WHERE id = ?').run(id)

    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '价格不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '删除成功',
    })
  } catch (error) {
    console.error('删除运输价格失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除运输价格失败',
      error: error.message,
    })
  }
})

// ==================== TARIC 税率管理 API ====================

// 获取税率列表
app.get('/api/tariff-rates', (req, res) => {
  try {
    const { search, hsCode, origin, page = 1, pageSize = 50 } = req.query
    let query = 'SELECT * FROM tariff_rates WHERE 1=1'
    let countQuery = 'SELECT COUNT(*) as total FROM tariff_rates WHERE 1=1'
    const params = []

    if (search) {
      query += ' AND (hs_code LIKE ? OR hs_code_10 LIKE ? OR goods_description LIKE ? OR goods_description_cn LIKE ?)'
      countQuery += ' AND (hs_code LIKE ? OR hs_code_10 LIKE ? OR goods_description LIKE ? OR goods_description_cn LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern, searchPattern)
    }

    if (hsCode) {
      query += ' AND (hs_code = ? OR hs_code_10 = ? OR hs_code LIKE ?)'
      countQuery += ' AND (hs_code = ? OR hs_code_10 = ? OR hs_code LIKE ?)'
      params.push(hsCode, hsCode, `${hsCode}%`)
    }

    if (origin) {
      query += ' AND (origin_country_code = ? OR origin_country LIKE ?)'
      countQuery += ' AND (origin_country_code = ? OR origin_country LIKE ?)'
      params.push(origin, `%${origin}%`)
    }

    // 获取总数
    const totalResult = db.prepare(countQuery).get(...params)
    const total = totalResult.total

    // 分页
    const offset = (Number(page) - 1) * Number(pageSize)
    query += ' ORDER BY hs_code ASC LIMIT ? OFFSET ?'

    const rates = db.prepare(query).all(...params, Number(pageSize), offset)

    res.json({
      errCode: 200,
      msg: 'success',
      data: rates.map(r => ({
        id: String(r.id),
        hsCode: r.hs_code,
        hsCode10: r.hs_code_10,
        goodsDescription: r.goods_description,
        goodsDescriptionCn: r.goods_description_cn,
        originCountry: r.origin_country,
        originCountryCode: r.origin_country_code,
        dutyRate: r.duty_rate,
        dutyRateType: r.duty_rate_type,
        vatRate: r.vat_rate,
        antiDumpingRate: r.anti_dumping_rate,
        countervailingRate: r.countervailing_rate,
        preferentialRate: r.preferential_rate,
        preferentialOrigin: r.preferential_origin,
        unitCode: r.unit_code,
        unitName: r.unit_name,
        supplementaryUnit: r.supplementary_unit,
        measureType: r.measure_type,
        measureCode: r.measure_code,
        legalBase: r.legal_base,
        startDate: r.start_date,
        endDate: r.end_date,
        quotaOrderNumber: r.quota_order_number,
        additionalCode: r.additional_code,
        footnotes: r.footnotes,
        isActive: r.is_active === 1,
        dataSource: r.data_source,
        lastSyncTime: r.last_sync_time,
        declarationType: r.declaration_type || 'per_unit',
        minDeclarationValue: r.min_declaration_value || 0,
        material: r.material,
        usageScenario: r.usage_scenario,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    })
  } catch (error) {
    console.error('获取税率列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取税率列表失败',
      error: error.message,
    })
  }
})

// 搜索税率（用于自动完成）
app.get('/api/tariff-rates/search', (req, res) => {
  try {
    const { hsCode, keyword, origin } = req.query
    const searchTerm = hsCode || keyword

    if (!searchTerm || searchTerm.length < 2) {
      return res.json({
        errCode: 200,
        msg: 'success',
        data: [],
      })
    }

    let query = `
      SELECT * FROM tariff_rates 
      WHERE (hs_code LIKE ? OR hs_code_10 LIKE ? OR goods_description LIKE ? OR goods_description_cn LIKE ?)
      AND is_active = 1
    `
    const searchPattern = `%${searchTerm}%`
    const params = [searchPattern, searchPattern, searchPattern, searchPattern]

    // 可选择性地按原产地过滤
    if (origin) {
      query += " AND (origin_country_code = ? OR origin_country_code IS NULL OR origin_country_code = '')"
      params.push(origin)
    }

    query += ' ORDER BY hs_code ASC LIMIT 20'
    const rates = db.prepare(query).all(...params)

    res.json({
      errCode: 200,
      msg: 'success',
      data: rates.map(r => ({
        id: String(r.id),
        hsCode: r.hs_code,
        hsCode10: r.hs_code_10,
        goodsDescription: r.goods_description,
        goodsDescriptionCn: r.goods_description_cn,
        originCountry: r.origin_country,
        originCountryCode: r.origin_country_code,
        dutyRate: r.duty_rate,
        dutyRateType: r.duty_rate_type,
        vatRate: r.vat_rate,
        antiDumpingRate: r.anti_dumping_rate || 0,
        countervailingRate: r.countervailing_rate || 0,
        preferentialRate: r.preferential_rate,
        preferentialOrigin: r.preferential_origin,
        unitCode: r.unit_code,
        unitName: r.unit_name,
      })),
    })
  } catch (error) {
    console.error('搜索税率失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '搜索税率失败',
      error: error.message,
    })
  }
})

// 根据HS编码查询税率
app.get('/api/tariff-rates/query', (req, res) => {
  try {
    const { hsCode, origin } = req.query

    if (!hsCode) {
      return res.status(400).json({
        errCode: 400,
        msg: 'HS编码是必填项',
      })
    }

    let query = `
      SELECT * FROM tariff_rates 
      WHERE (hs_code = ? OR hs_code_10 = ? OR hs_code LIKE ?)
      AND is_active = 1
    `
    const params = [hsCode, hsCode, `${hsCode}%`]

    if (origin) {
      query += ' AND (origin_country_code = ? OR origin_country_code IS NULL OR origin_country_code = "")'
      params.push(origin)
    }

    query += ' ORDER BY hs_code_10 DESC, origin_country_code DESC LIMIT 10'

    const rates = db.prepare(query).all(...params)

    res.json({
      errCode: 200,
      msg: 'success',
      data: rates.map(r => ({
        id: String(r.id),
        hsCode: r.hs_code,
        hsCode10: r.hs_code_10,
        goodsDescription: r.goods_description,
        goodsDescriptionCn: r.goods_description_cn,
        originCountry: r.origin_country,
        originCountryCode: r.origin_country_code,
        dutyRate: r.duty_rate,
        dutyRateType: r.duty_rate_type,
        vatRate: r.vat_rate,
        antiDumpingRate: r.anti_dumping_rate,
        countervailingRate: r.countervailing_rate,
        preferentialRate: r.preferential_rate,
        unitCode: r.unit_code,
        unitName: r.unit_name,
        declarationType: r.declaration_type || 'per_unit',
        minDeclarationValue: r.min_declaration_value || 0,
        material: r.material,
        usageScenario: r.usage_scenario,
      })),
    })
  } catch (error) {
    console.error('查询税率失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '查询税率失败',
      error: error.message,
    })
  }
})

// 创建税率
app.post('/api/tariff-rates', (req, res) => {
  try {
    const {
      hsCode, hsCode10, goodsDescription, goodsDescriptionCn,
      originCountry, originCountryCode, dutyRate, dutyRateType,
      vatRate, antiDumpingRate, countervailingRate, preferentialRate,
      preferentialOrigin, unitCode, unitName, supplementaryUnit,
      measureType, measureCode, legalBase, startDate, endDate,
      quotaOrderNumber, additionalCode, footnotes, isActive, dataSource,
      declarationType, minDeclarationValue, material, usageScenario
    } = req.body

    if (!hsCode || !goodsDescription) {
      return res.status(400).json({
        errCode: 400,
        msg: 'HS编码和商品描述是必填项',
      })
    }

    const result = db.prepare(`
      INSERT INTO tariff_rates (
        hs_code, hs_code_10, goods_description, goods_description_cn,
        origin_country, origin_country_code, duty_rate, duty_rate_type,
        vat_rate, anti_dumping_rate, countervailing_rate, preferential_rate,
        preferential_origin, unit_code, unit_name, supplementary_unit,
        measure_type, measure_code, legal_base, start_date, end_date,
        quota_order_number, additional_code, footnotes, is_active, data_source,
        declaration_type, min_declaration_value, material, usage_scenario
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      hsCode, hsCode10 || '', goodsDescription, goodsDescriptionCn || '',
      originCountry || '', originCountryCode || '', dutyRate || 0, dutyRateType || 'percentage',
      vatRate || 19, antiDumpingRate || 0, countervailingRate || 0, preferentialRate || null,
      preferentialOrigin || '', unitCode || '', unitName || '', supplementaryUnit || '',
      measureType || '', measureCode || '', legalBase || '', startDate || '', endDate || '',
      quotaOrderNumber || '', additionalCode || '', footnotes || '', isActive !== false ? 1 : 0, dataSource || 'manual',
      declarationType || 'per_unit', minDeclarationValue || 0, material || '', usageScenario || ''
    )

    res.json({
      errCode: 200,
      msg: '创建成功',
      data: { id: String(result.lastInsertRowid) },
    })
  } catch (error) {
    console.error('创建税率失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建税率失败',
      error: error.message,
    })
  }
})

// 更新税率
app.put('/api/tariff-rates/:id', (req, res) => {
  try {
    const { id } = req.params
    const {
      hsCode, hsCode10, goodsDescription, goodsDescriptionCn,
      originCountry, originCountryCode, dutyRate, dutyRateType,
      vatRate, antiDumpingRate, countervailingRate, preferentialRate,
      preferentialOrigin, unitCode, unitName, supplementaryUnit,
      measureType, measureCode, legalBase, startDate, endDate,
      quotaOrderNumber, additionalCode, footnotes, isActive,
      declarationType, minDeclarationValue, material, usageScenario
    } = req.body

    // 获取旧数据用于记录历史
    const oldRate = db.prepare('SELECT * FROM tariff_rates WHERE id = ?').get(id)
    if (!oldRate) {
      return res.status(404).json({
        errCode: 404,
        msg: '税率不存在',
      })
    }

    // 更新数据
    const result = db.prepare(`
      UPDATE tariff_rates SET
        hs_code = ?, hs_code_10 = ?, goods_description = ?, goods_description_cn = ?,
        origin_country = ?, origin_country_code = ?, duty_rate = ?, duty_rate_type = ?,
        vat_rate = ?, anti_dumping_rate = ?, countervailing_rate = ?, preferential_rate = ?,
        preferential_origin = ?, unit_code = ?, unit_name = ?, supplementary_unit = ?,
        measure_type = ?, measure_code = ?, legal_base = ?, start_date = ?, end_date = ?,
        quota_order_number = ?, additional_code = ?, footnotes = ?, is_active = ?,
        declaration_type = ?, min_declaration_value = ?, material = ?, usage_scenario = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      hsCode, hsCode10 || '', goodsDescription, goodsDescriptionCn || '',
      originCountry || '', originCountryCode || '', dutyRate || 0, dutyRateType || 'percentage',
      vatRate || 19, antiDumpingRate || 0, countervailingRate || 0, preferentialRate || null,
      preferentialOrigin || '', unitCode || '', unitName || '', supplementaryUnit || '',
      measureType || '', measureCode || '', legalBase || '', startDate || '', endDate || '',
      quotaOrderNumber || '', additionalCode || '', footnotes || '', isActive !== false ? 1 : 0,
      declarationType || 'per_unit', minDeclarationValue || 0, material || '', usageScenario || '',
      id
    )

    // 如果税率有变化，记录历史
    if (oldRate.duty_rate !== dutyRate || oldRate.vat_rate !== vatRate) {
      db.prepare(`
        INSERT INTO tariff_rate_history (
          tariff_rate_id, hs_code, old_duty_rate, new_duty_rate,
          old_vat_rate, new_vat_rate, change_type, change_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, hsCode, oldRate.duty_rate, dutyRate, oldRate.vat_rate, vatRate, 'update', '手动更新')
    }

    res.json({
      errCode: 200,
      msg: '更新成功',
    })
  } catch (error) {
    console.error('更新税率失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新税率失败',
      error: error.message,
    })
  }
})

// 删除税率
app.delete('/api/tariff-rates/:id', (req, res) => {
  try {
    const { id } = req.params
    const result = db.prepare('DELETE FROM tariff_rates WHERE id = ?').run(id)

    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '税率不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '删除成功',
    })
  } catch (error) {
    console.error('删除税率失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除税率失败',
      error: error.message,
    })
  }
})

// 批量导入税率
app.post('/api/tariff-rates/import', (req, res) => {
  try {
    const { rates } = req.body

    if (!rates || !Array.isArray(rates) || rates.length === 0) {
      return res.status(400).json({
        errCode: 400,
        msg: '请提供有效的税率数据',
      })
    }

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO tariff_rates (
        hs_code, hs_code_10, goods_description, goods_description_cn,
        origin_country, origin_country_code, duty_rate, duty_rate_type,
        vat_rate, anti_dumping_rate, countervailing_rate, preferential_rate,
        preferential_origin, unit_code, unit_name, supplementary_unit,
        measure_type, measure_code, legal_base, start_date, end_date,
        quota_order_number, additional_code, footnotes, is_active, data_source,
        last_sync_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)

    let successCount = 0
    let failCount = 0
    const errors = []

    const transaction = db.transaction(() => {
      for (const rate of rates) {
        try {
          insertStmt.run(
            rate.hsCode || rate.hs_code || '',
            rate.hsCode10 || rate.hs_code_10 || '',
            rate.goodsDescription || rate.goods_description || '',
            rate.goodsDescriptionCn || rate.goods_description_cn || '',
            rate.originCountry || rate.origin_country || '',
            rate.originCountryCode || rate.origin_country_code || '',
            rate.dutyRate || rate.duty_rate || 0,
            rate.dutyRateType || rate.duty_rate_type || 'percentage',
            rate.vatRate || rate.vat_rate || 19,
            rate.antiDumpingRate || rate.anti_dumping_rate || 0,
            rate.countervailingRate || rate.countervailing_rate || 0,
            rate.preferentialRate || rate.preferential_rate || null,
            rate.preferentialOrigin || rate.preferential_origin || '',
            rate.unitCode || rate.unit_code || '',
            rate.unitName || rate.unit_name || '',
            rate.supplementaryUnit || rate.supplementary_unit || '',
            rate.measureType || rate.measure_type || '',
            rate.measureCode || rate.measure_code || '',
            rate.legalBase || rate.legal_base || '',
            rate.startDate || rate.start_date || '',
            rate.endDate || rate.end_date || '',
            rate.quotaOrderNumber || rate.quota_order_number || '',
            rate.additionalCode || rate.additional_code || '',
            rate.footnotes || '',
            1,
            rate.dataSource || rate.data_source || 'import'
          )
          successCount++
        } catch (err) {
          failCount++
          errors.push({ hsCode: rate.hsCode || rate.hs_code, error: err.message })
        }
      }
    })

    transaction()

    res.json({
      errCode: 200,
      msg: `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`,
      data: {
        successCount,
        failCount,
        errors: errors.slice(0, 10), // 只返回前10条错误
      },
    })
  } catch (error) {
    console.error('批量导入税率失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '批量导入税率失败',
      error: error.message,
    })
  }
})

// 获取税率变更历史
app.get('/api/tariff-rates/:id/history', (req, res) => {
  try {
    const { id } = req.params
    const history = db.prepare(`
      SELECT * FROM tariff_rate_history
      WHERE tariff_rate_id = ?
      ORDER BY changed_at DESC
      LIMIT 50
    `).all(id)

    res.json({
      errCode: 200,
      msg: 'success',
      data: history.map(h => ({
        id: h.id,
        tariffRateId: h.tariff_rate_id,
        hsCode: h.hs_code,
        oldDutyRate: h.old_duty_rate,
        newDutyRate: h.new_duty_rate,
        oldVatRate: h.old_vat_rate,
        newVatRate: h.new_vat_rate,
        changeType: h.change_type,
        changeReason: h.change_reason,
        changedBy: h.changed_by,
        changedAt: h.changed_at,
      })),
    })
  } catch (error) {
    console.error('获取税率历史失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取税率历史失败',
      error: error.message,
    })
  }
})

// 获取税率统计信息
app.get('/api/tariff-rates/stats', (req, res) => {
  try {
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM tariff_rates').get()
    const activeCount = db.prepare('SELECT COUNT(*) as count FROM tariff_rates WHERE is_active = 1').get()
    const sourceStats = db.prepare(`
      SELECT data_source, COUNT(*) as count 
      FROM tariff_rates 
      GROUP BY data_source
    `).all()

    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        total: totalCount.count,
        active: activeCount.count,
        inactive: totalCount.count - activeCount.count,
        bySource: sourceStats.reduce((acc, s) => {
          acc[s.data_source || 'unknown'] = s.count
          return acc
        }, {}),
      },
    })
  } catch (error) {
    console.error('获取税率统计失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取税率统计失败',
      error: error.message,
    })
  }
})

// ==================== 系统设置 API ====================

// 获取系统设置
app.get('/api/system-settings', async (req, res) => {
  try {
    const { key } = req.query
    let query = 'SELECT * FROM system_settings'
    const params = []

    if (key) {
      query += ' WHERE setting_key = ?'
      params.push(key)
    }

    const settings = await db.prepare(query).all(...params)
    
    // 转换为键值对格式
    const settingsMap = {}
    settings.forEach(s => {
      let value = s.setting_value
      if (s.setting_type === 'json') {
        try {
          value = JSON.parse(s.setting_value)
        } catch (e) {
          // 解析失败，保持原值
        }
      } else if (s.setting_type === 'number') {
        value = Number(s.setting_value)
      } else if (s.setting_type === 'boolean') {
        value = s.setting_value === 'true'
      }
      settingsMap[s.setting_key] = value
    })

    res.json({
      errCode: 200,
      msg: 'success',
      data: settingsMap,
    })
  } catch (error) {
    console.error('获取系统设置失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取系统设置失败',
      error: error.message,
    })
  }
})

// 保存系统设置
app.post('/api/system-settings', async (req, res) => {
  try {
    const { key, value, type, description } = req.body

    if (!key) {
      return res.status(400).json({
        errCode: 400,
        msg: '设置键名是必填项',
      })
    }

    // 将值转换为字符串存储
    let stringValue = value
    let settingType = type || 'string'
    if (typeof value === 'object') {
      stringValue = JSON.stringify(value)
      settingType = 'json'
    } else if (typeof value === 'boolean') {
      stringValue = value.toString()
      settingType = 'boolean'
    } else if (typeof value === 'number') {
      stringValue = value.toString()
      settingType = 'number'
    }

    // 先检查是否存在
    const existing = await db.prepare(
      'SELECT id FROM system_settings WHERE setting_key = ?'
    ).get(key)

    if (existing) {
      // 更新
      await db.prepare(`
        UPDATE system_settings 
        SET setting_value = ?, setting_type = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE setting_key = ?
      `).run(stringValue, settingType, description || '', key)
    } else {
      // 插入
      await db.prepare(`
        INSERT INTO system_settings (setting_key, setting_value, setting_type, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(key, stringValue, settingType, description || '')
    }

    res.json({
      errCode: 200,
      msg: '保存成功',
    })
  } catch (error) {
    console.error('保存系统设置失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '保存系统设置失败',
      error: error.message,
    })
  }
})

// 批量保存系统设置
app.post('/api/system-settings/batch', async (req, res) => {
  try {
    const { settings } = req.body

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        errCode: 400,
        msg: '设置数据格式错误',
      })
    }

    for (const [key, value] of Object.entries(settings)) {
      let stringValue = value
      let settingType = 'string'
      if (typeof value === 'object') {
        stringValue = JSON.stringify(value)
        settingType = 'json'
      } else if (typeof value === 'boolean') {
        stringValue = value.toString()
        settingType = 'boolean'
      } else if (typeof value === 'number') {
        stringValue = value.toString()
        settingType = 'number'
      }

      const existing = await db.prepare(
        'SELECT id FROM system_settings WHERE setting_key = ?'
      ).get(key)

      if (existing) {
        await db.prepare(`
          UPDATE system_settings 
          SET setting_value = ?, setting_type = ?, updated_at = CURRENT_TIMESTAMP
          WHERE setting_key = ?
        `).run(stringValue, settingType, key)
      } else {
        await db.prepare(`
          INSERT INTO system_settings (setting_key, setting_value, setting_type, created_at, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(key, stringValue, settingType)
      }
    }

    res.json({
      errCode: 200,
      msg: '批量保存成功',
    })
  } catch (error) {
    console.error('批量保存系统设置失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '批量保存系统设置失败',
      error: error.message,
    })
  }
})

// 删除系统设置
app.delete('/api/system-settings/:key', async (req, res) => {
  try {
    const { key } = req.params
    await db.prepare('DELETE FROM system_settings WHERE setting_key = ?').run(key)
    res.json({
      errCode: 200,
      msg: '删除成功',
    })
  } catch (error) {
    console.error('删除系统设置失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除系统设置失败',
      error: error.message,
    })
  }
})

// ==================== 运输方式 API ====================

// 获取所有运输方式
app.get('/api/transport-methods', (req, res) => {
  try {
    const { search, status } = req.query
    let query = 'SELECT * FROM transport_methods WHERE 1=1'
    const params = []

    if (search) {
      query += ' AND (name LIKE ? OR code LIKE ? OR description LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern)
    }

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    query += ' ORDER BY sort_order, name'

    const methods = db.prepare(query).all(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: methods.map(m => ({
        id: String(m.id),
        name: m.name,
        code: m.code,
        description: m.description,
        icon: m.icon,
        sortOrder: m.sort_order,
        status: m.status,
        createTime: m.created_at,
      })),
    })
  } catch (error) {
    console.error('获取运输方式失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取运输方式失败',
      error: error.message,
    })
  }
})

// 获取启用的运输方式名称列表（用于下拉选择）
app.get('/api/transport-methods/names', (req, res) => {
  try {
    const methods = db.prepare(
      'SELECT name FROM transport_methods WHERE status = ? ORDER BY sort_order'
    ).all('active')
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: methods.map(m => m.name),
    })
  } catch (error) {
    console.error('获取运输方式名称失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取运输方式名称失败',
      error: error.message,
    })
  }
})

// 创建运输方式
app.post('/api/transport-methods', (req, res) => {
  try {
    const { name, code, description, icon, sortOrder, status } = req.body

    if (!name || !code) {
      return res.status(400).json({
        errCode: 400,
        msg: '运输方式名称和代码是必填项',
      })
    }

    const result = db.prepare(`
      INSERT INTO transport_methods (name, code, description, icon, sort_order, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, code.toUpperCase(), description || '', icon || '', sortOrder || 0, status || 'active')

    res.json({
      errCode: 200,
      msg: '创建成功',
      data: { id: String(result.lastInsertRowid) },
    })
  } catch (error) {
    console.error('创建运输方式失败:', error)
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res.status(400).json({
        errCode: 400,
        msg: '运输方式代码已存在',
      })
    }
    res.status(500).json({
      errCode: 500,
      msg: '创建运输方式失败',
      error: error.message,
    })
  }
})

// 更新运输方式
app.put('/api/transport-methods/:id', (req, res) => {
  try {
    const { id } = req.params
    const { name, code, description, icon, sortOrder, status } = req.body

    const result = db.prepare(`
      UPDATE transport_methods 
      SET name = ?, code = ?, description = ?, icon = ?, sort_order = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, code?.toUpperCase(), description, icon, sortOrder, status, id)

    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '运输方式不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '更新成功',
    })
  } catch (error) {
    console.error('更新运输方式失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新运输方式失败',
      error: error.message,
    })
  }
})

// 删除运输方式
app.delete('/api/transport-methods/:id', (req, res) => {
  try {
    const { id } = req.params
    const result = db.prepare('DELETE FROM transport_methods WHERE id = ?').run(id)

    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '运输方式不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '删除成功',
    })
  } catch (error) {
    console.error('删除运输方式失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除运输方式失败',
      error: error.message,
    })
  }
})

// ==================== 增值税率管理 API ====================

// 获取增值税率列表
app.get('/api/vat-rates', (req, res) => {
  try {
    const { search, status } = req.query
    let query = 'SELECT * FROM vat_rates WHERE 1=1'
    const params = []

    if (search) {
      query += ' AND (country_code LIKE ? OR country_name LIKE ? OR description LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern)
    }

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    query += ' ORDER BY country_name'

    const rates = db.prepare(query).all(...params)

    res.json({
      errCode: 200,
      msg: 'success',
      data: rates.map(item => ({
        id: String(item.id),
        countryCode: item.country_code,
        countryName: item.country_name,
        standardRate: item.standard_rate,
        reducedRate: item.reduced_rate,
        superReducedRate: item.super_reduced_rate,
        parkingRate: item.parking_rate,
        description: item.description,
        effectiveDate: item.effective_date,
        status: item.status,
        createTime: item.created_at,
        updateTime: item.updated_at,
      })),
    })
  } catch (error) {
    console.error('获取增值税率列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取增值税率列表失败',
      error: error.message,
    })
  }
})

// 新增增值税率
app.post('/api/vat-rates', (req, res) => {
  try {
    const { countryCode, countryName, standardRate, reducedRate, superReducedRate, parkingRate, description, effectiveDate, status } = req.body

    if (!countryCode || !countryName) {
      return res.status(400).json({
        errCode: 400,
        msg: '国家代码和国家名称为必填项',
      })
    }

    // 检查是否已存在
    const existing = db.prepare('SELECT id FROM vat_rates WHERE country_code = ?').get(countryCode)
    if (existing) {
      return res.status(400).json({
        errCode: 400,
        msg: '该国家的增值税率已存在',
      })
    }

    const result = db.prepare(`
      INSERT INTO vat_rates (country_code, country_name, standard_rate, reduced_rate, super_reduced_rate, parking_rate, description, effective_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      countryCode,
      countryName,
      standardRate || 0,
      reducedRate || 0,
      superReducedRate || 0,
      parkingRate || 0,
      description || '',
      effectiveDate || null,
      status || 'active'
    )

    res.json({
      errCode: 200,
      msg: '创建成功',
      data: { id: String(result.lastInsertRowid) },
    })
  } catch (error) {
    console.error('创建增值税率失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建增值税率失败',
      error: error.message,
    })
  }
})

// 更新增值税率
app.put('/api/vat-rates/:id', (req, res) => {
  try {
    const { id } = req.params
    const { countryCode, countryName, standardRate, reducedRate, superReducedRate, parkingRate, description, effectiveDate, status } = req.body

    const result = db.prepare(`
      UPDATE vat_rates 
      SET country_code = ?, country_name = ?, standard_rate = ?, reduced_rate = ?, super_reduced_rate = ?, parking_rate = ?, description = ?, effective_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      countryCode,
      countryName,
      standardRate || 0,
      reducedRate || 0,
      superReducedRate || 0,
      parkingRate || 0,
      description || '',
      effectiveDate || null,
      status || 'active',
      id
    )

    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '增值税率不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '更新成功',
    })
  } catch (error) {
    console.error('更新增值税率失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新增值税率失败',
      error: error.message,
    })
  }
})

// 删除增值税率
app.delete('/api/vat-rates/:id', (req, res) => {
  try {
    const { id } = req.params
    const result = db.prepare('DELETE FROM vat_rates WHERE id = ?').run(id)

    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '增值税率不存在',
      })
    }

    res.json({
      errCode: 200,
      msg: '删除成功',
    })
  } catch (error) {
    console.error('删除增值税率失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除增值税率失败',
      error: error.message,
    })
  }
})

// 按国家代码获取增值税率
app.get('/api/vat-rates/by-country/:countryCode', (req, res) => {
  try {
    const { countryCode } = req.params
    const rate = db.prepare('SELECT * FROM vat_rates WHERE country_code = ? AND status = ?').get(countryCode.toUpperCase(), 'active')

    if (!rate) {
      // 如果没有找到，返回默认税率19%
      return res.json({
        errCode: 200,
        msg: 'success',
        data: {
          countryCode: countryCode.toUpperCase(),
          countryName: '默认',
          standardRate: 19,
          reducedRate: 0,
          isDefault: true,
        },
      })
    }

    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: String(rate.id),
        countryCode: rate.country_code,
        countryName: rate.country_name,
        standardRate: rate.standard_rate,
        reducedRate: rate.reduced_rate,
        superReducedRate: rate.super_reduced_rate,
        parkingRate: rate.parking_rate,
        description: rate.description,
        isDefault: false,
      },
    })
  } catch (error) {
    console.error('获取增值税率失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取增值税率失败',
      error: error.message,
    })
  }
})

// ==================== 用户认证与管理 API ====================

// 密码哈希函数
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password + 'sysafari_salt').digest('hex')
}

// 获取安全配置
function getSecuritySetting(key, defaultValue = null) {
  try {
    const setting = db.prepare('SELECT setting_value FROM security_settings WHERE setting_key = ?').get(key)
    return setting ? setting.setting_value : defaultValue
  } catch (e) {
    return defaultValue
  }
}

// 密码强度验证
function validatePasswordStrength(password) {
  const errors = []
  const minLength = parseInt(getSecuritySetting('password_min_length', '8'))
  const requireUppercase = getSecuritySetting('password_require_uppercase', '1') === '1'
  const requireLowercase = getSecuritySetting('password_require_lowercase', '1') === '1'
  const requireNumber = getSecuritySetting('password_require_number', '1') === '1'
  const requireSpecial = getSecuritySetting('password_require_special', '1') === '1'

  if (password.length < minLength) {
    errors.push(`密码长度不能少于${minLength}位`)
  }
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('密码必须包含大写字母')
  }
  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('密码必须包含小写字母')
  }
  if (requireNumber && !/[0-9]/.test(password)) {
    errors.push('密码必须包含数字')
  }
  if (requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('密码必须包含特殊字符')
  }

  return { valid: errors.length === 0, errors }
}

// 检查账号是否被锁定
function isAccountLocked(username) {
  try {
    const lockoutAttempts = parseInt(getSecuritySetting('login_lockout_attempts', '5'))
    const lockoutDuration = parseInt(getSecuritySetting('login_lockout_duration', '15'))
    
    const recentFailures = db.prepare(`
      SELECT COUNT(*) as count FROM login_attempts 
      WHERE username = ? AND success = 0 
        AND attempt_time > datetime('now', '-' || ? || ' minutes')
    `).get(username, lockoutDuration)

    if (recentFailures.count >= lockoutAttempts) {
      const lastFailure = db.prepare(`
        SELECT attempt_time FROM login_attempts 
        WHERE username = ? AND success = 0 
        ORDER BY attempt_time DESC LIMIT 1
      `).get(username)
      
      if (lastFailure) {
        const lastFailureTime = new Date(lastFailure.attempt_time)
        const unlockTime = new Date(lastFailureTime.getTime() + lockoutDuration * 60 * 1000)
        const remainingMinutes = Math.ceil((unlockTime - new Date()) / 60000)
        return { locked: true, remainingMinutes: Math.max(0, remainingMinutes) }
      }
    }
  } catch (e) {
    console.error('检查账号锁定状态失败:', e)
  }
  return { locked: false, remainingMinutes: 0 }
}

// 记录登录尝试
function recordLoginAttempt(username, ip, success, reason = null) {
  try {
    db.prepare(`
      INSERT INTO login_attempts (username, ip_address, success, failure_reason)
      VALUES (?, ?, ?, ?)
    `).run(username, ip, success ? 1 : 0, reason)
  } catch (e) {
    console.error('记录登录尝试失败:', e)
  }
}

// 记录登录日志
function recordLoginLog(userId, username, ip, userAgent, status, reason = null) {
  try {
    db.prepare(`
      INSERT INTO login_logs (user_id, username, ip_address, user_agent, status, failure_reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, username, ip, userAgent, status, reason)
  } catch (e) {
    console.error('记录登录日志失败:', e)
  }
}

// 生成6位验证码
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// 获取角色名称
function getRoleName(roleCode) {
  const roleNames = {
    'admin': '系统管理员',
    'manager': '业务经理',
    'operator': '操作员',
    'viewer': '查看者',
  }
  return roleNames[roleCode] || roleCode
}

// 用户登录 (异步版本，支持 PostgreSQL)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, verificationCode } = req.body
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown'
    const userAgent = req.get('User-Agent') || 'unknown'

    if (!username || !password) {
      return res.status(400).json({
        errCode: 400,
        msg: '用户名和密码不能为空',
      })
    }

    // 查询用户 (使用 await 支持 PostgreSQL)
    const user = await db.prepare('SELECT * FROM users WHERE username = ?').get(username)
    
    if (!user) {
      return res.status(401).json({
        errCode: 401,
        msg: '用户名或密码错误',
      })
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        errCode: 403,
        msg: '账号已被禁用，请联系管理员',
      })
    }

    const passwordHash = hashPassword(password)
    if (user.password_hash !== passwordHash) {
      return res.status(401).json({
        errCode: 401,
        msg: '用户名或密码错误',
      })
    }

    // 登录成功，更新登录信息
    const loginTime = new Date().toISOString()
    await db.prepare(`
      UPDATE users SET 
        last_login_time = ?,
        last_login_ip = ?,
        login_count = COALESCE(login_count, 0) + 1,
        updated_at = NOW()
      WHERE id = ?
    `).run(loginTime, clientIp, user.id)

    // 获取用户权限
    const permissionsResult = await db.prepare(`
      SELECT p.permission_code 
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_code = p.permission_code
      WHERE rp.role_code = ?
    `).all(user.role)
    
    const permissions = permissionsResult ? permissionsResult.map(p => p.permission_code) : []

    const token = crypto.randomBytes(32).toString('hex')

    res.json({
      errCode: 200,
      msg: '登录成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          roleName: getRoleName(user.role),
        },
        permissions,
        token,
      },
    })
  } catch (error) {
    console.error('登录失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '登录失败，请稍后重试',
    })
  }
})

// 发送登录验证码
app.post('/api/auth/send-verification-code', (req, res) => {
  try {
    const { username } = req.body

    if (!username) {
      return res.status(400).json({ errCode: 400, msg: '用户名不能为空' })
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
    if (!user) {
      return res.status(404).json({ errCode: 404, msg: '用户不存在' })
    }
    if (!user.email) {
      return res.status(400).json({ errCode: 400, msg: '该用户未设置邮箱' })
    }

    // 检查频率限制（1分钟内只能发送一次）
    const recentCode = db.prepare(`
      SELECT * FROM verification_codes 
      WHERE username = ? AND type = 'login' 
        AND created_at > datetime('now', '-1 minutes')
    `).get(username)

    if (recentCode) {
      return res.status(429).json({ errCode: 429, msg: '验证码发送过于频繁，请1分钟后再试' })
    }

    const code = generateVerificationCode()
    const expiryMinutes = parseInt(getSecuritySetting('verification_code_expiry', '5'))
    
    db.prepare(`
      INSERT INTO verification_codes (user_id, username, email, code, type, expires_at)
      VALUES (?, ?, ?, ?, 'login', datetime('now', '+' || ? || ' minutes'))
    `).run(user.id, username, user.email, code, expiryMinutes)

    // TODO: 实际发送邮件（需要配置SMTP）
    console.log(`[验证码] 用户 ${username} 的登录验证码: ${code}，有效期 ${expiryMinutes} 分钟`)

    res.json({
      errCode: 200,
      msg: '验证码已发送',
      data: {
        email: user.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
        expiryMinutes,
        code, // 开发环境返回验证码，生产环境应移除
      },
    })
  } catch (error) {
    console.error('发送验证码失败:', error)
    res.status(500).json({ errCode: 500, msg: '发送验证码失败' })
  }
})

// 获取登录日志
app.get('/api/auth/login-logs', (req, res) => {
  try {
    const { page = 1, pageSize = 20, username, status } = req.query
    
    let query = 'SELECT * FROM login_logs WHERE 1=1'
    const params = []

    if (username) {
      query += ' AND username LIKE ?'
      params.push(`%${username}%`)
    }
    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count')
    const total = db.prepare(countQuery).get(...params).count

    query += ' ORDER BY login_time DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))

    const logs = db.prepare(query).all(...params)

    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        list: logs.map(log => ({
          id: log.id,
          userId: log.user_id,
          username: log.username,
          loginTime: log.login_time,
          ipAddress: log.ip_address,
          userAgent: log.user_agent,
          status: log.status,
          failureReason: log.failure_reason,
        })),
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    })
  } catch (error) {
    console.error('获取登录日志失败:', error)
    res.status(500).json({ errCode: 500, msg: '获取登录日志失败' })
  }
})

// 获取安全配置
app.get('/api/security/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM security_settings ORDER BY id').all()
    res.json({
      errCode: 200,
      msg: 'success',
      data: settings.map(s => ({
        key: s.setting_key,
        value: s.setting_value,
        description: s.description,
      })),
    })
  } catch (error) {
    console.error('获取安全配置失败:', error)
    res.status(500).json({ errCode: 500, msg: '获取安全配置失败' })
  }
})

// 更新安全配置
app.put('/api/security/settings', (req, res) => {
  try {
    const { settings } = req.body
    if (!settings || !Array.isArray(settings)) {
      return res.status(400).json({ errCode: 400, msg: '无效的配置数据' })
    }

    const updateStmt = db.prepare(`
      UPDATE security_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?
    `)
    for (const setting of settings) {
      if (setting.key && setting.value !== undefined) {
        updateStmt.run(setting.value.toString(), setting.key)
      }
    }

    res.json({ errCode: 200, msg: '配置更新成功' })
  } catch (error) {
    console.error('更新安全配置失败:', error)
    res.status(500).json({ errCode: 500, msg: '更新安全配置失败' })
  }
})

// 修改密码
app.post('/api/auth/change-password', (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({
        errCode: 400,
        msg: '参数不完整',
      })
    }

    // 验证密码强度
    const strengthCheck = validatePasswordStrength(newPassword)
    if (!strengthCheck.valid) {
      return res.status(400).json({
        errCode: 400,
        msg: strengthCheck.errors.join('；'),
      })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        errCode: 400,
        msg: '新密码长度不能少于6位',
      })
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    if (!user) {
      return res.status(404).json({
        errCode: 404,
        msg: '用户不存在',
      })
    }

    const oldPasswordHash = hashPassword(oldPassword)
    if (user.password_hash !== oldPasswordHash) {
      return res.status(401).json({
        errCode: 401,
        msg: '原密码错误',
      })
    }

    const newPasswordHash = hashPassword(newPassword)
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newPasswordHash, userId)

    res.json({
      errCode: 200,
      msg: '密码修改成功',
    })
  } catch (error) {
    console.error('修改密码失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '修改密码失败',
    })
  }
})

// 获取用户列表
app.get('/api/users', (req, res) => {
  try {
    const { search, role, status, page = 1, pageSize = 20 } = req.query
    
    let query = 'SELECT * FROM users WHERE 1=1'
    const params = []

    if (search) {
      query += ' AND (username LIKE ? OR name LIKE ? OR email LIKE ? OR phone LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern, searchPattern)
    }

    if (role) {
      query += ' AND role = ?'
      params.push(role)
    }

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count')
    const total = db.prepare(countQuery).get(...params).count

    // 分页
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))

    const users = db.prepare(query).all(...params)

    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        list: users.map(u => ({
          id: u.id,
          username: u.username,
          name: u.name,
          email: u.email,
          phone: u.phone,
          avatar: u.avatar,
          role: u.role,
          roleName: getRoleName(u.role),
          status: u.status,
          lastLoginTime: u.last_login_time,
          lastLoginIp: u.last_login_ip,
          loginCount: u.login_count,
          createTime: u.created_at,
          updateTime: u.updated_at,
        })),
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    })
  } catch (error) {
    console.error('获取用户列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取用户列表失败',
    })
  }
})

// 获取用户详情
app.get('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)

    if (!user) {
      return res.status(404).json({
        errCode: 404,
        msg: '用户不存在',
      })
    }

    // 获取用户权限
    const permissions = db.prepare(`
      SELECT p.permission_code, p.permission_name, p.module
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_code = p.permission_code
      WHERE rp.role_code = ?
    `).all(user.role)

    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        roleName: getRoleName(user.role),
        status: user.status,
        lastLoginTime: user.last_login_time,
        lastLoginIp: user.last_login_ip,
        loginCount: user.login_count,
        createTime: user.created_at,
        updateTime: user.updated_at,
        permissions,
      },
    })
  } catch (error) {
    console.error('获取用户详情失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取用户详情失败',
    })
  }
})

// 创建用户
app.post('/api/users', (req, res) => {
  try {
    const { username, password, name, email, phone, role = 'operator', status = 'active' } = req.body

    if (!username || !password || !name) {
      return res.status(400).json({
        errCode: 400,
        msg: '用户名、密码和姓名为必填项',
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        errCode: 400,
        msg: '密码长度不能少于6位',
      })
    }

    // 检查用户名是否已存在
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (existingUser) {
      return res.status(400).json({
        errCode: 400,
        msg: '用户名已存在',
      })
    }

    const passwordHash = hashPassword(password)
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, name, email, phone, role, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(username, passwordHash, name, email || '', phone || '', role, status)

    res.json({
      errCode: 200,
      msg: '创建成功',
      data: {
        id: result.lastInsertRowid,
        username,
        name,
        email,
        phone,
        role,
        roleName: getRoleName(role),
        status,
      },
    })
  } catch (error) {
    console.error('创建用户失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '创建用户失败',
    })
  }
})

// 更新用户信息
app.put('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params
    const { name, email, phone, role, status } = req.body

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    if (!user) {
      return res.status(404).json({
        errCode: 404,
        msg: '用户不存在',
      })
    }

    // 防止修改唯一管理员
    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin').count
      if (adminCount <= 1) {
        return res.status(400).json({
          errCode: 400,
          msg: '不能修改最后一个管理员的角色',
        })
      }
    }

    db.prepare(`
      UPDATE users SET 
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        role = COALESCE(?, role),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, email, phone, role, status, id)

    res.json({
      errCode: 200,
      msg: '更新成功',
    })
  } catch (error) {
    console.error('更新用户失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新用户失败',
    })
  }
})

// 重置用户密码
app.post('/api/users/:id/reset-password', (req, res) => {
  try {
    const { id } = req.params
    const { newPassword = 'password123' } = req.body

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    if (!user) {
      return res.status(404).json({
        errCode: 404,
        msg: '用户不存在',
      })
    }

    const passwordHash = hashPassword(newPassword)
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(passwordHash, id)

    res.json({
      errCode: 200,
      msg: '密码重置成功',
      data: { newPassword },
    })
  } catch (error) {
    console.error('重置密码失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '重置密码失败',
    })
  }
})

// 删除用户
app.delete('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    if (!user) {
      return res.status(404).json({
        errCode: 404,
        msg: '用户不存在',
      })
    }

    // 防止删除唯一管理员
    if (user.role === 'admin') {
      const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin').count
      if (adminCount <= 1) {
        return res.status(400).json({
          errCode: 400,
          msg: '不能删除最后一个管理员账号',
        })
      }
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id)

    res.json({
      errCode: 200,
      msg: '删除成功',
    })
  } catch (error) {
    console.error('删除用户失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '删除用户失败',
    })
  }
})

// 切换用户状态
app.put('/api/users/:id/status', (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    if (!user) {
      return res.status(404).json({
        errCode: 404,
        msg: '用户不存在',
      })
    }

    // 防止禁用唯一管理员
    if (user.role === 'admin' && status === 'inactive') {
      const activeAdminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ? AND status = ?').get('admin', 'active').count
      if (activeAdminCount <= 1) {
        return res.status(400).json({
          errCode: 400,
          msg: '不能禁用最后一个活跃的管理员账号',
        })
      }
    }

    db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(status, id)

    res.json({
      errCode: 200,
      msg: status === 'active' ? '账号已启用' : '账号已禁用',
    })
  } catch (error) {
    console.error('切换用户状态失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '切换用户状态失败',
    })
  }
})

// 获取角色列表
app.get('/api/roles', (req, res) => {
  try {
    const roles = db.prepare('SELECT * FROM roles WHERE status = ? ORDER BY id').all('active')

    res.json({
      errCode: 200,
      msg: 'success',
      data: roles.map(r => ({
        id: r.id,
        roleCode: r.role_code,
        roleName: r.role_name,
        description: r.description,
        isSystem: r.is_system === 1,
        status: r.status,
      })),
    })
  } catch (error) {
    console.error('获取角色列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取角色列表失败',
    })
  }
})

// 创建角色
app.post('/api/roles', (req, res) => {
  try {
    const { roleCode, roleName, description, colorCode, status } = req.body

    if (!roleCode || !roleName) {
      return res.status(400).json({ errCode: 400, msg: '角色代码和名称为必填项' })
    }

    // 检查角色代码是否已存在
    const existing = db.prepare('SELECT id FROM roles WHERE role_code = ?').get(roleCode)
    if (existing) {
      return res.status(400).json({ errCode: 400, msg: '角色代码已存在' })
    }

    // 插入新角色
    const result = db.prepare(`
      INSERT INTO roles (role_code, role_name, description, color_code, is_system, status, created_at)
      VALUES (?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP)
    `).run(roleCode, roleName, description || '', colorCode || 'blue', status || 'active')

    res.json({
      errCode: 200,
      msg: '角色创建成功',
      data: { id: result.lastInsertRowid }
    })
  } catch (error) {
    console.error('创建角色失败:', error)
    res.status(500).json({ errCode: 500, msg: '创建角色失败' })
  }
})

// 更新角色
app.put('/api/roles/:roleCode', (req, res) => {
  try {
    const { roleCode } = req.params
    const { roleName, description, colorCode, status } = req.body

    // 检查是否为系统角色
    const role = db.prepare('SELECT * FROM roles WHERE role_code = ?').get(roleCode)
    if (!role) {
      return res.status(404).json({ errCode: 404, msg: '角色不存在' })
    }
    if (role.is_system === 1) {
      return res.status(400).json({ errCode: 400, msg: '系统角色不可修改' })
    }

    // 更新角色
    db.prepare(`
      UPDATE roles SET role_name = ?, description = ?, color_code = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE role_code = ?
    `).run(roleName, description || '', colorCode || 'blue', status || 'active', roleCode)

    res.json({ errCode: 200, msg: '角色更新成功' })
  } catch (error) {
    console.error('更新角色失败:', error)
    res.status(500).json({ errCode: 500, msg: '更新角色失败' })
  }
})

// 删除角色
app.delete('/api/roles/:roleCode', (req, res) => {
  try {
    const { roleCode } = req.params

    // 检查是否为系统角色
    const role = db.prepare('SELECT * FROM roles WHERE role_code = ?').get(roleCode)
    if (!role) {
      return res.status(404).json({ errCode: 404, msg: '角色不存在' })
    }
    if (role.is_system === 1) {
      return res.status(400).json({ errCode: 400, msg: '系统角色不可删除' })
    }

    // 检查是否有用户使用该角色
    const usersWithRole = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get(roleCode)
    if (usersWithRole.count > 0) {
      return res.status(400).json({ errCode: 400, msg: `该角色下有 ${usersWithRole.count} 个用户，无法删除` })
    }

    // 删除角色权限关联
    db.prepare('DELETE FROM role_permissions WHERE role_code = ?').run(roleCode)
    
    // 删除角色
    db.prepare('DELETE FROM roles WHERE role_code = ?').run(roleCode)

    res.json({ errCode: 200, msg: '角色删除成功' })
  } catch (error) {
    console.error('删除角色失败:', error)
    res.status(500).json({ errCode: 500, msg: '删除角色失败' })
  }
})

// 获取权限列表
app.get('/api/permissions', (req, res) => {
  try {
    const permissions = db.prepare('SELECT * FROM permissions ORDER BY module, sort_order').all()

    // 按模块分组
    const grouped = permissions.reduce((acc, p) => {
      if (!acc[p.module]) {
        acc[p.module] = []
      }
      acc[p.module].push({
        permissionCode: p.permission_code,
        permissionName: p.permission_name,
        description: p.description,
        category: p.module,
      })
      return acc
    }, {})

    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        list: permissions.map(p => ({
          permissionCode: p.permission_code,
          permissionName: p.permission_name,
          module: p.module,
          description: p.description,
          category: p.module,
        })),
        grouped,
      },
    })
  } catch (error) {
    console.error('获取权限列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取权限列表失败',
    })
  }
})

// 获取角色权限
app.get('/api/roles/:roleCode/permissions', (req, res) => {
  try {
    const { roleCode } = req.params
    const permissions = db.prepare(`
      SELECT p.* 
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_code = p.permission_code
      WHERE rp.role_code = ?
      ORDER BY p.module, p.sort_order
    `).all(roleCode)

    res.json({
      errCode: 200,
      msg: 'success',
      data: permissions.map(p => ({
        permissionCode: p.permission_code,
        permissionName: p.permission_name,
        module: p.module,
        description: p.description,
        category: p.module,
      })),
    })
  } catch (error) {
    console.error('获取角色权限失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取角色权限失败',
    })
  }
})

// 更新角色权限
app.put('/api/roles/:roleCode/permissions', (req, res) => {
  try {
    const { roleCode } = req.params
    const { permissions } = req.body

    // 检查角色是否存在
    const role = db.prepare('SELECT * FROM roles WHERE role_code = ?').get(roleCode)
    if (!role) {
      return res.status(404).json({
        errCode: 404,
        msg: '角色不存在',
      })
    }

    // 不允许修改admin角色的权限
    if (roleCode === 'admin') {
      return res.status(403).json({
        errCode: 403,
        msg: '不允许修改系统管理员权限',
      })
    }

    // 验证权限是否都存在
    if (permissions && permissions.length > 0) {
      const existingPerms = db.prepare(
        `SELECT permission_code FROM permissions WHERE permission_code IN (${permissions.map(() => '?').join(',')})`
      ).all(...permissions)
      
      if (existingPerms.length !== permissions.length) {
        return res.status(400).json({
          errCode: 400,
          msg: '部分权限不存在',
        })
      }
    }

    // 使用事务更新权限
    const updatePermissions = db.transaction(() => {
      // 删除原有权限
      db.prepare('DELETE FROM role_permissions WHERE role_code = ?').run(roleCode)
      
      // 添加新权限
      if (permissions && permissions.length > 0) {
        const insertStmt = db.prepare('INSERT INTO role_permissions (role_code, permission_code) VALUES (?, ?)')
        for (const permCode of permissions) {
          insertStmt.run(roleCode, permCode)
        }
      }
    })

    updatePermissions()

    res.json({
      errCode: 200,
      msg: '权限更新成功',
    })
  } catch (error) {
    console.error('更新角色权限失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '更新角色权限失败',
    })
  }
})

// 分配订单给操作员
app.post('/api/bills/:billId/assign', (req, res) => {
  try {
    const { billId } = req.params
    const { operatorId, assignedBy } = req.body

    // 检查订单是否存在
    const bill = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(billId)
    if (!bill) {
      return res.status(404).json({
        errCode: 404,
        msg: '订单不存在',
      })
    }

    // 检查操作员是否存在
    const operator = db.prepare('SELECT * FROM users WHERE id = ?').get(operatorId)
    if (!operator) {
      return res.status(404).json({
        errCode: 404,
        msg: '操作员不存在',
      })
    }

    // 更新订单分配
    db.prepare(`
      UPDATE bills_of_lading 
      SET assigned_operator_id = ?, assigned_operator_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(operatorId, operator.name, billId)

    // 记录分配
    db.prepare(`
      INSERT OR REPLACE INTO user_bill_assignments (user_id, bill_id, assigned_by)
      VALUES (?, ?, ?)
    `).run(operatorId, billId, assignedBy || null)

    // 记录操作日志
    logOperation(billId, 'assign', '分配操作员', bill.assigned_operator_name || '未分配', operator.name, 'system', `分配给 ${operator.name}`)

    res.json({
      errCode: 200,
      msg: '分配成功',
      data: {
        billId,
        operatorId,
        operatorName: operator.name,
      },
    })
  } catch (error) {
    console.error('分配订单失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '分配订单失败',
    })
  }
})

// 获取操作员列表（用于分配订单）
app.get('/api/operators', (req, res) => {
  try {
    const operators = db.prepare(`
      SELECT id, username, name, email, role 
      FROM users 
      WHERE status = 'active' AND role IN ('admin', 'manager', 'operator')
      ORDER BY role, name
    `).all()

    res.json({
      errCode: 200,
      msg: 'success',
      data: operators.map(o => ({
        id: o.id,
        username: o.username,
        name: o.name,
        email: o.email,
        role: o.role,
        roleName: getRoleName(o.role),
      })),
    })
  } catch (error) {
    console.error('获取操作员列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '获取操作员列表失败',
    })
  }
})

// ==================== CRM 客户管理 API ====================

// 获取客户统计
app.get('/api/customers/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as totalCount,
        SUM(CASE WHEN customer_level = 'vip' THEN 1 ELSE 0 END) as vipCount,
        SUM(CASE WHEN customer_level = 'important' THEN 1 ELSE 0 END) as importantCount,
        SUM(CASE WHEN customer_level = 'normal' THEN 1 ELSE 0 END) as normalCount,
        SUM(CASE WHEN customer_level = 'potential' THEN 1 ELSE 0 END) as potentialCount,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeCount,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactiveCount
      FROM customers
    `).get()
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        // 兼容两种格式
        total: stats.totalCount || 0,
        totalCount: stats.totalCount || 0,
        byLevel: {
          vip: stats.vipCount || 0,
          important: stats.importantCount || 0,
          normal: stats.normalCount || 0,
          potential: stats.potentialCount || 0
        },
        byStatus: {
          active: stats.activeCount || 0,
          inactive: stats.inactiveCount || 0
        },
        // 也保留扁平格式供其他页面使用
        vipCount: stats.vipCount || 0,
        importantCount: stats.importantCount || 0,
        normalCount: stats.normalCount || 0,
        activeCount: stats.activeCount || 0,
        inactiveCount: stats.inactiveCount || 0
      }
    })
  } catch (error) {
    console.error('获取客户统计失败:', error)
    res.status(500).json({ errCode: 500, msg: '获取客户统计失败' })
  }
})

// 获取客户列表
app.get('/api/customers', (req, res) => {
  try {
    const { type, level, status, search, page = 1, pageSize = 20 } = req.query
    
    let query = 'SELECT * FROM customers WHERE 1=1'
    const params = []
    
    if (type) {
      query += ' AND customer_type = ?'
      params.push(type)
    }
    
    if (level) {
      query += ' AND customer_level = ?'
      params.push(level)
    }
    
    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    
    if (search) {
      query += ' AND (customer_name LIKE ? OR customer_code LIKE ? OR contact_person LIKE ?)'
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    
    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
    const total = db.prepare(countQuery).get(...params).total
    
    // 分页
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const customers = db.prepare(query).all(...params)
    
    // 转换为驼峰命名
    const list = customers.map(c => ({
      id: c.id,
      customerCode: c.customer_code,
      customerName: c.customer_name,
      companyName: c.company_name,
      customerType: c.customer_type,
      customerLevel: c.customer_level,
      countryCode: c.country_code,
      province: c.province,
      city: c.city,
      address: c.address,
      postalCode: c.postal_code,
      contactPerson: c.contact_person,
      contactPhone: c.contact_phone,
      contactEmail: c.contact_email,
      taxNumber: c.tax_number,
      bankName: c.bank_name,
      bankAccount: c.bank_account,
      creditLimit: c.credit_limit,
      paymentTerms: c.payment_terms,
      assignedTo: c.assigned_to,
      assignedName: c.assigned_name,
      tags: c.tags ? JSON.parse(c.tags) : [],
      notes: c.notes,
      status: c.status,
      lastFollowUpTime: c.last_follow_up_time,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }))
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        list,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
  } catch (error) {
    console.error('获取客户列表失败:', error)
    res.status(500).json({ errCode: 500, msg: '获取客户列表失败' })
  }
})

// 获取客户详情
app.get('/api/customers/:id', (req, res) => {
  try {
    const { id } = req.params
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id)
    
    if (!customer) {
      return res.status(404).json({ errCode: 404, msg: '客户不存在' })
    }
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: customer.id,
        customerCode: customer.customer_code,
        customerName: customer.customer_name,
        companyName: customer.company_name,
        customerType: customer.customer_type,
        customerLevel: customer.customer_level,
        countryCode: customer.country_code,
        province: customer.province,
        city: customer.city,
        address: customer.address,
        postalCode: customer.postal_code,
        contactPerson: customer.contact_person,
        contactPhone: customer.contact_phone,
        contactEmail: customer.contact_email,
        taxNumber: customer.tax_number,
        bankName: customer.bank_name,
        bankAccount: customer.bank_account,
        creditLimit: customer.credit_limit,
        paymentTerms: customer.payment_terms,
        assignedTo: customer.assigned_to,
        assignedName: customer.assigned_name,
        tags: customer.tags ? JSON.parse(customer.tags) : [],
        notes: customer.notes,
        status: customer.status,
        lastFollowUpTime: customer.last_follow_up_time,
        createdAt: customer.created_at,
        updatedAt: customer.updated_at
      }
    })
  } catch (error) {
    console.error('获取客户详情失败:', error)
    res.status(500).json({ errCode: 500, msg: '获取客户详情失败' })
  }
})

// 创建客户
app.post('/api/customers', (req, res) => {
  try {
    const data = req.body
    const id = `cust-${Date.now()}`
    
    // 生成客户编号
    const maxCode = db.prepare(`SELECT MAX(CAST(SUBSTR(customer_code, 2) AS INTEGER)) as max_num FROM customers`).get()
    const nextNum = (maxCode?.max_num || 2500000) + 1
    const customerCode = `C${nextNum}`
    
    db.prepare(`
      INSERT INTO customers (
        id, customer_code, customer_name, company_name, customer_type, customer_level,
        country_code, province, city, address, postal_code,
        contact_person, contact_phone, contact_email, tax_number,
        bank_name, bank_account, credit_limit, payment_terms,
        assigned_to, assigned_name, tags, notes, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `).run(
      id, customerCode, data.customerName, data.companyName, data.customerType || 'shipper', data.customerLevel || 'normal',
      data.countryCode, data.province, data.city, data.address, data.postalCode,
      data.contactPerson, data.contactPhone, data.contactEmail, data.taxNumber,
      data.bankName, data.bankAccount, data.creditLimit || 0, data.paymentTerms,
      data.assignedTo, data.assignedName, JSON.stringify(data.tags || []), data.notes, 'active'
    )
    
    res.json({ errCode: 200, msg: '创建成功', data: { id, customerCode } })
  } catch (error) {
    console.error('创建客户失败:', error)
    res.status(500).json({ errCode: 500, msg: '创建客户失败' })
  }
})

// 更新客户
app.put('/api/customers/:id', (req, res) => {
  try {
    const { id } = req.params
    const data = req.body
    
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ errCode: 404, msg: '客户不存在' })
    }
    
    db.prepare(`
      UPDATE customers SET
        customer_name = COALESCE(?, customer_name),
        company_name = COALESCE(?, company_name),
        customer_type = COALESCE(?, customer_type),
        customer_level = COALESCE(?, customer_level),
        country_code = COALESCE(?, country_code),
        province = COALESCE(?, province),
        city = COALESCE(?, city),
        address = COALESCE(?, address),
        postal_code = COALESCE(?, postal_code),
        contact_person = COALESCE(?, contact_person),
        contact_phone = COALESCE(?, contact_phone),
        contact_email = COALESCE(?, contact_email),
        tax_number = COALESCE(?, tax_number),
        bank_name = COALESCE(?, bank_name),
        bank_account = COALESCE(?, bank_account),
        credit_limit = COALESCE(?, credit_limit),
        payment_terms = COALESCE(?, payment_terms),
        notes = COALESCE(?, notes),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      data.customerName, data.companyName, data.customerType, data.customerLevel,
      data.countryCode, data.province, data.city, data.address, data.postalCode,
      data.contactPerson, data.contactPhone, data.contactEmail, data.taxNumber,
      data.bankName, data.bankAccount, data.creditLimit, data.paymentTerms, data.notes, id
    )
    
    res.json({ errCode: 200, msg: '更新成功' })
  } catch (error) {
    console.error('更新客户失败:', error)
    res.status(500).json({ errCode: 500, msg: '更新客户失败' })
  }
})

// 删除客户
app.delete('/api/customers/:id', (req, res) => {
  try {
    const { id } = req.params
    
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ errCode: 404, msg: '客户不存在' })
    }
    
    db.prepare('DELETE FROM customers WHERE id = ?').run(id)
    
    res.json({ errCode: 200, msg: '删除成功' })
  } catch (error) {
    console.error('删除客户失败:', error)
    res.status(500).json({ errCode: 500, msg: '删除客户失败' })
  }
})

// ==================== 销售机会 API ====================

// 获取销售机会统计
app.get('/api/opportunities/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as totalCount,
        SUM(CASE WHEN stage = 'lead' THEN 1 ELSE 0 END) as leadCount,
        SUM(CASE WHEN stage = 'qualification' THEN 1 ELSE 0 END) as qualificationCount,
        SUM(CASE WHEN stage = 'proposal' THEN 1 ELSE 0 END) as proposalCount,
        SUM(CASE WHEN stage = 'negotiation' THEN 1 ELSE 0 END) as negotiationCount,
        SUM(CASE WHEN stage = 'closed_won' OR stage = 'won' THEN 1 ELSE 0 END) as closedWonCount,
        SUM(CASE WHEN stage = 'closed_lost' OR stage = 'lost' THEN 1 ELSE 0 END) as closedLostCount,
        SUM(CASE WHEN stage = 'closed_won' OR stage = 'won' THEN expected_amount ELSE 0 END) as wonAmount,
        SUM(expected_amount) as pipelineValue
      FROM sales_opportunities
    `).get()
    
    // 计算胜率
    const totalClosed = (stats?.closedWonCount || 0) + (stats?.closedLostCount || 0)
    const winRate = totalClosed > 0 ? ((stats?.closedWonCount || 0) / totalClosed * 100).toFixed(1) + '%' : '0%'
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        total: stats?.totalCount || 0,
        totalCount: stats?.totalCount || 0,
        byStage: {
          lead: stats?.leadCount || 0,
          qualification: stats?.qualificationCount || 0,
          proposal: stats?.proposalCount || 0,
          negotiation: stats?.negotiationCount || 0,
          closedWon: stats?.closedWonCount || 0,
          closedLost: stats?.closedLostCount || 0
        },
        pipelineValue: stats?.pipelineValue || 0,
        wonValue: stats?.wonAmount || 0,
        wonAmount: stats?.wonAmount || 0,
        winRate: winRate
      }
    })
  } catch (error) {
    console.error('获取销售机会统计失败:', error)
    res.json({ errCode: 200, msg: 'success', data: { 
      total: 0, totalCount: 0, 
      byStage: { lead: 0, qualification: 0, proposal: 0, negotiation: 0, closedWon: 0, closedLost: 0 },
      pipelineValue: 0, wonValue: 0, wonAmount: 0, winRate: '0%' 
    }})
  }
})

// ==================== 客户反馈 API ====================

// 获取反馈统计
app.get('/api/feedbacks/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as totalCount,
        SUM(CASE WHEN feedback_type = 'complaint' THEN 1 ELSE 0 END) as complaintCount,
        SUM(CASE WHEN feedback_type = 'suggestion' THEN 1 ELSE 0 END) as suggestionCount,
        SUM(CASE WHEN feedback_type = 'inquiry' THEN 1 ELSE 0 END) as inquiryCount,
        SUM(CASE WHEN feedback_type = 'praise' THEN 1 ELSE 0 END) as praiseCount,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as openCount,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processingCount,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolvedCount,
        SUM(CASE WHEN priority = 'high' OR priority = 'urgent' THEN 1 ELSE 0 END) as highPriorityCount
      FROM customer_feedbacks
    `).get()
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        total: stats?.totalCount || 0,
        totalCount: stats?.totalCount || 0,
        byType: {
          complaint: stats?.complaintCount || 0,
          suggestion: stats?.suggestionCount || 0,
          inquiry: stats?.inquiryCount || 0,
          praise: stats?.praiseCount || 0
        },
        byStatus: {
          open: stats?.openCount || 0,
          processing: stats?.processingCount || 0,
          resolved: stats?.resolvedCount || 0
        },
        highPriority: stats?.highPriorityCount || 0,
        // 兼容扁平格式
        pendingCount: stats?.openCount || 0,
        processingCount: stats?.processingCount || 0,
        resolvedCount: stats?.resolvedCount || 0
      }
    })
  } catch (error) {
    console.error('获取反馈统计失败:', error)
    res.json({ errCode: 200, msg: 'success', data: { 
      total: 0, totalCount: 0, 
      byType: { complaint: 0, suggestion: 0, inquiry: 0, praise: 0 },
      byStatus: { open: 0, processing: 0, resolved: 0 },
      highPriority: 0, pendingCount: 0, processingCount: 0, resolvedCount: 0 
    }})
  }
})

// ==================== 销售机会 API ====================

// 获取销售机会列表
app.get('/api/opportunities', (req, res) => {
  try {
    const { stage, customerId, search, page = 1, pageSize = 20 } = req.query
    
    let query = 'SELECT * FROM sales_opportunities WHERE 1=1'
    const params = []
    
    if (stage) {
      query += ' AND stage = ?'
      params.push(stage)
    }
    
    if (customerId) {
      query += ' AND customer_id = ?'
      params.push(customerId)
    }
    
    if (search) {
      query += ' AND (opportunity_name LIKE ? OR customer_name LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }
    
    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
    const total = db.prepare(countQuery).get(...params).total
    
    // 分页
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const opportunities = db.prepare(query).all(...params)
    
    // 转换为驼峰命名
    const list = opportunities.map(o => ({
      id: o.id,
      opportunityName: o.opportunity_name,
      customerId: o.customer_id,
      customerName: o.customer_name,
      stage: o.stage,
      expectedAmount: o.expected_amount,
      probability: o.probability,
      expectedCloseDate: o.expected_close_date,
      description: o.description,
      assignedTo: o.assigned_to,
      assignedName: o.assigned_name,
      createdAt: o.created_at,
      updatedAt: o.updated_at
    }))
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize) }
    })
  } catch (error) {
    console.error('获取销售机会列表失败:', error)
    res.status(500).json({ errCode: 500, msg: '获取销售机会列表失败' })
  }
})

// 创建销售机会
app.post('/api/opportunities', (req, res) => {
  try {
    const data = req.body
    const id = `opp-${Date.now()}`
    
    db.prepare(`
      INSERT INTO sales_opportunities (
        id, opportunity_name, customer_id, customer_name, stage,
        expected_amount, probability, expected_close_date, description,
        assigned_to, assigned_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `).run(
      id, data.opportunityName, data.customerId, data.customerName, data.stage || 'lead',
      data.expectedAmount || 0, data.probability || 0, data.expectedCloseDate,
      data.description, data.assignedTo, data.assignedName
    )
    
    res.json({ errCode: 200, msg: '创建成功', data: { id } })
  } catch (error) {
    console.error('创建销售机会失败:', error)
    res.status(500).json({ errCode: 500, msg: '创建销售机会失败' })
  }
})

// 更新销售机会
app.put('/api/opportunities/:id', (req, res) => {
  try {
    const { id } = req.params
    const data = req.body
    
    db.prepare(`
      UPDATE sales_opportunities SET
        opportunity_name = COALESCE(?, opportunity_name),
        customer_id = COALESCE(?, customer_id),
        customer_name = COALESCE(?, customer_name),
        stage = COALESCE(?, stage),
        expected_amount = COALESCE(?, expected_amount),
        probability = COALESCE(?, probability),
        expected_close_date = COALESCE(?, expected_close_date),
        description = COALESCE(?, description),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      data.opportunityName, data.customerId, data.customerName, data.stage,
      data.expectedAmount, data.probability, data.expectedCloseDate,
      data.description, id
    )
    
    res.json({ errCode: 200, msg: '更新成功' })
  } catch (error) {
    console.error('更新销售机会失败:', error)
    res.status(500).json({ errCode: 500, msg: '更新销售机会失败' })
  }
})

// 删除销售机会
app.delete('/api/opportunities/:id', (req, res) => {
  try {
    const { id } = req.params
    db.prepare('DELETE FROM sales_opportunities WHERE id = ?').run(id)
    res.json({ errCode: 200, msg: '删除成功' })
  } catch (error) {
    console.error('删除销售机会失败:', error)
    res.status(500).json({ errCode: 500, msg: '删除销售机会失败' })
  }
})

// ==================== 报价管理 API ====================

// 获取报价列表
app.get('/api/quotations', (req, res) => {
  try {
    const { status, customerId, search, page = 1, pageSize = 20 } = req.query
    
    let query = 'SELECT * FROM quotations WHERE 1=1'
    const params = []
    
    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    
    if (customerId) {
      query += ' AND customer_id = ?'
      params.push(customerId)
    }
    
    if (search) {
      query += ' AND (quotation_number LIKE ? OR customer_name LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }
    
    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
    const total = db.prepare(countQuery).get(...params)?.total || 0
    
    // 分页
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const quotations = db.prepare(query).all(...params)
    
    const list = quotations.map(q => ({
      id: q.id,
      quotationNumber: q.quotation_number,
      customerId: q.customer_id,
      customerName: q.customer_name,
      opportunityId: q.opportunity_id,
      totalAmount: q.total_amount,
      validUntil: q.valid_until,
      status: q.status,
      description: q.description,
      createdAt: q.created_at,
      updatedAt: q.updated_at
    }))
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize) }
    })
  } catch (error) {
    console.error('获取报价列表失败:', error)
    res.json({ errCode: 200, msg: 'success', data: { list: [], total: 0, page: 1, pageSize: 20 } })
  }
})

// ==================== 合同管理 API ====================

// 获取合同列表
app.get('/api/contracts', (req, res) => {
  try {
    const { status, customerId, search, page = 1, pageSize = 20 } = req.query
    
    let query = 'SELECT * FROM contracts WHERE 1=1'
    const params = []
    
    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    
    if (customerId) {
      query += ' AND customer_id = ?'
      params.push(customerId)
    }
    
    if (search) {
      query += ' AND (contract_number LIKE ? OR customer_name LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }
    
    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
    const total = db.prepare(countQuery).get(...params)?.total || 0
    
    // 分页
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const contracts = db.prepare(query).all(...params)
    
    const list = contracts.map(c => ({
      id: c.id,
      contractNumber: c.contract_number,
      customerId: c.customer_id,
      customerName: c.customer_name,
      quotationId: c.quotation_id,
      totalAmount: c.total_amount,
      startDate: c.start_date,
      endDate: c.end_date,
      status: c.status,
      description: c.description,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }))
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize) }
    })
  } catch (error) {
    console.error('获取合同列表失败:', error)
    res.json({ errCode: 200, msg: 'success', data: { list: [], total: 0, page: 1, pageSize: 20 } })
  }
})

// ==================== 客户反馈 API ====================

// 获取反馈列表
app.get('/api/feedbacks', (req, res) => {
  try {
    const { status, type, customerId, search, page = 1, pageSize = 20 } = req.query
    
    let query = 'SELECT * FROM customer_feedbacks WHERE 1=1'
    const params = []
    
    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    
    if (type) {
      query += ' AND feedback_type = ?'
      params.push(type)
    }
    
    if (customerId) {
      query += ' AND customer_id = ?'
      params.push(customerId)
    }
    
    if (search) {
      query += ' AND (title LIKE ? OR customer_name LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }
    
    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
    const total = db.prepare(countQuery).get(...params)?.total || 0
    
    // 分页
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const feedbacks = db.prepare(query).all(...params)
    
    const list = feedbacks.map(f => ({
      id: f.id,
      title: f.title,
      customerId: f.customer_id,
      customerName: f.customer_name,
      feedbackType: f.feedback_type,
      priority: f.priority,
      status: f.status,
      content: f.content,
      resolution: f.resolution,
      resolvedAt: f.resolved_at,
      createdAt: f.created_at,
      updatedAt: f.updated_at
    }))
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize) }
    })
  } catch (error) {
    console.error('获取反馈列表失败:', error)
    res.json({ errCode: 200, msg: 'success', data: { list: [], total: 0, page: 1, pageSize: 20 } })
  }
})

// ==================== 财务管理 API ====================

// 获取财务概览
app.get('/api/finance/overview', async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    
    // 获取当月的起止日期
    const now = new Date()
    const currentMonth = now.getMonth() + 1 // 1-12
    const currentYear = now.getFullYear()
    const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
    const monthEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`
    
    // 获取发票统计
    const invoiceStats = await db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN invoice_type = 'sales' THEN total_amount ELSE 0 END), 0) as receivable,
        COALESCE(SUM(CASE WHEN invoice_type = 'purchase' THEN total_amount ELSE 0 END), 0) as payable,
        COUNT(CASE WHEN invoice_type = 'sales' THEN 1 END) as salesCount,
        COUNT(CASE WHEN invoice_type = 'purchase' THEN 1 END) as purchaseCount
      FROM invoices
    `).get()
    
    // 获取收付款统计（全部）
    const paymentStats = await db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN payment_type = 'income' THEN amount ELSE 0 END), 0) as totalIncome,
        COALESCE(SUM(CASE WHEN payment_type = 'expense' THEN amount ELSE 0 END), 0) as totalExpense,
        COUNT(CASE WHEN payment_type = 'income' THEN 1 END) as incomeCount,
        COUNT(CASE WHEN payment_type = 'expense' THEN 1 END) as expenseCount
      FROM payments
    `).get()
    
    // 获取当月营业收入
    const monthlyIncomeStats = await db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN payment_type = 'income' THEN amount ELSE 0 END), 0) as monthlyIncome
      FROM payments
      WHERE payment_date >= ? AND payment_date <= ?
    `).get(monthStart, monthEnd)
    
    // 获取费用统计
    const feeStats = await db.prepare(`
      SELECT 
        COALESCE(SUM(amount), 0) as totalFees,
        COUNT(*) as feeCount
      FROM fees
    `).get()
    
    const netCashFlow = (paymentStats?.totalIncome || 0) - (paymentStats?.totalExpense || 0)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        summary: {
          receivable: invoiceStats?.receivable || 0,
          payable: invoiceStats?.payable || 0,
          netCashFlow: netCashFlow,
          totalFees: feeStats?.totalFees || 0,
          monthlyIncome: monthlyIncomeStats?.monthlyIncome || 0,
          currentMonth: currentMonth
        },
        invoices: {
          salesCount: invoiceStats?.salesCount || 0,
          purchaseCount: invoiceStats?.purchaseCount || 0,
          salesAmount: invoiceStats?.receivable || 0,
          purchaseAmount: invoiceStats?.payable || 0
        },
        payments: {
          incomeCount: paymentStats?.incomeCount || 0,
          expenseCount: paymentStats?.expenseCount || 0,
          totalIncome: paymentStats?.totalIncome || 0,
          totalExpense: paymentStats?.totalExpense || 0,
          netCashFlow: netCashFlow
        },
        fees: {
          totalFees: feeStats?.totalFees || 0,
          feeCount: feeStats?.feeCount || 0
        }
      }
    })
  } catch (error) {
    console.error('获取财务概览失败:', error)
    res.json({ errCode: 200, msg: 'success', data: {
      summary: { receivable: 0, payable: 0, netCashFlow: 0, totalFees: 0, monthlyIncome: 0, currentMonth: new Date().getMonth() + 1 },
      invoices: { salesCount: 0, purchaseCount: 0, salesAmount: 0, purchaseAmount: 0 },
      payments: { incomeCount: 0, expenseCount: 0, totalIncome: 0, totalExpense: 0, netCashFlow: 0 },
      fees: { totalFees: 0, feeCount: 0 }
    }})
  }
})

// 获取发票统计
app.get('/api/invoices/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        invoice_type,
        status,
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(paid_amount), 0) as paid_amount
      FROM invoices
      GROUP BY invoice_type, status
    `).all()
    
    // 构建分类统计 - 使用前端期望的字段名
    const salesStats = { totalCount: 0, totalAmount: 0, paidAmount: 0, unpaidAmount: 0 }
    const purchaseStats = { totalCount: 0, totalAmount: 0, paidAmount: 0, unpaidAmount: 0 }
    
    stats.forEach(row => {
      const target = row.invoice_type === 'sales' ? salesStats : purchaseStats
      target.totalCount += row.count
      target.totalAmount += row.total_amount
      target.paidAmount += row.paid_amount
    })
    
    // 计算未付金额
    salesStats.unpaidAmount = salesStats.totalAmount - salesStats.paidAmount
    purchaseStats.unpaidAmount = purchaseStats.totalAmount - purchaseStats.paidAmount
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        sales: salesStats,
        purchase: purchaseStats,
        totalCount: salesStats.totalCount + purchaseStats.totalCount,
        totalAmount: salesStats.totalAmount + purchaseStats.totalAmount
      }
    })
  } catch (error) {
    console.error('获取发票统计失败:', error)
    res.json({ errCode: 200, msg: 'success', data: {
      sales: { totalCount: 0, totalAmount: 0, paidAmount: 0, unpaidAmount: 0 },
      purchase: { totalCount: 0, totalAmount: 0, paidAmount: 0, unpaidAmount: 0 },
      totalCount: 0, totalAmount: 0
    }})
  }
})

// 获取费用统计
app.get('/api/fees/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        category,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM fees
      GROUP BY category
    `).all()
    
    // 返回数组格式，前端期望 byCategory 是数组，字段名为 total 和 count
    const byCategory = stats.map(row => ({
      category: row.category || 'other',
      count: row.count,
      total: row.total_amount  // 前端期望 total 而不是 amount
    }))
    
    let totalCount = 0
    let totalAmount = 0
    stats.forEach(row => {
      totalCount += row.count
      totalAmount += row.total_amount
    })
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        byCategory,
        totalCount,
        totalAmount
      }
    })
  } catch (error) {
    console.error('获取费用统计失败:', error)
    res.json({ errCode: 200, msg: 'success', data: { byCategory: [], totalCount: 0, totalAmount: 0 }})
  }
})

// 获取收付款统计
app.get('/api/payments/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        payment_type,
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM payments
      GROUP BY payment_type, status
    `).all()
    
    // 前端期望: total是金额, count是笔数
    const incomeStats = { total: 0, count: 0, completed: 0, pending: 0 }
    const expenseStats = { total: 0, count: 0, completed: 0, pending: 0 }
    
    stats.forEach(row => {
      const target = row.payment_type === 'income' ? incomeStats : expenseStats
      target.count += row.count
      target.total += row.total_amount
      if (row.status === 'completed') target.completed += row.count
      else if (row.status === 'pending') target.pending += row.count
    })
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        income: incomeStats,
        expense: expenseStats,
        netCashFlow: incomeStats.total - expenseStats.total,
        totalCount: incomeStats.count + expenseStats.count
      }
    })
  } catch (error) {
    console.error('获取收付款统计失败:', error)
    res.json({ errCode: 200, msg: 'success', data: {
      income: { total: 0, count: 0, completed: 0, pending: 0 },
      expense: { total: 0, count: 0, completed: 0, pending: 0 },
      netCashFlow: 0, totalCount: 0
    }})
  }
})

// 获取订单维度财务报表
app.get('/api/finance/reports/orders', (req, res) => {
  try {
    const { startDate, endDate, page = 1, pageSize = 20 } = req.query
    
    let dateFilter = ''
    const params = []
    
    if (startDate) {
      dateFilter += ' AND f.fee_date >= ?'
      params.push(startDate)
    }
    if (endDate) {
      dateFilter += ' AND f.fee_date <= ?'
      params.push(endDate)
    }
    
    // 按订单汇总费用
    const listQuery = `
      SELECT 
        f.bill_id as billId,
        f.bill_number as billNumber,
        f.customer_id as customerId,
        f.customer_name as customerName,
        COUNT(f.id) as feeCount,
        COALESCE(SUM(f.amount), 0) as totalAmount,
        COALESCE(SUM(CASE WHEN f.category = 'freight' THEN f.amount ELSE 0 END), 0) as freightAmount,
        COALESCE(SUM(CASE WHEN f.category = 'customs' THEN f.amount ELSE 0 END), 0) as customsAmount,
        COALESCE(SUM(CASE WHEN f.category = 'warehouse' THEN f.amount ELSE 0 END), 0) as warehouseAmount,
        COALESCE(SUM(CASE WHEN f.category = 'handling' THEN f.amount ELSE 0 END), 0) as handlingAmount,
        COALESCE(SUM(CASE WHEN f.category NOT IN ('freight', 'customs', 'warehouse', 'handling') THEN f.amount ELSE 0 END), 0) as otherAmount,
        MIN(f.fee_date) as firstFeeDate,
        MAX(f.fee_date) as lastFeeDate
      FROM fees f
      WHERE f.bill_id IS NOT NULL ${dateFilter}
      GROUP BY f.bill_id, f.bill_number, f.customer_id, f.customer_name
      ORDER BY totalAmount DESC
      LIMIT ? OFFSET ?
    `
    const list = db.prepare(listQuery).all(...params, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    // 获取汇总统计
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT f.bill_id) as orderCount,
        COUNT(f.id) as feeCount,
        COALESCE(SUM(f.amount), 0) as totalAmount
      FROM fees f
      WHERE f.bill_id IS NOT NULL ${dateFilter}
    `
    const summary = db.prepare(summaryQuery).get(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        list,
        total: summary?.orderCount || 0,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        summary: {
          orderCount: summary?.orderCount || 0,
          feeCount: summary?.feeCount || 0,
          totalAmount: summary?.totalAmount || 0,
          averageFeePerOrder: summary?.orderCount > 0 ? (summary?.totalAmount / summary?.orderCount) : 0
        }
      }
    })
  } catch (error) {
    console.error('获取订单报表失败:', error)
    res.json({ errCode: 200, msg: 'success', data: {
      list: [], total: 0, page: 1, pageSize: 20,
      summary: { orderCount: 0, feeCount: 0, totalAmount: 0, averageFeePerOrder: 0 }
    }})
  }
})

// 获取客户维度财务报表
app.get('/api/finance/reports/customers', (req, res) => {
  try {
    const { startDate, endDate, page = 1, pageSize = 20 } = req.query
    
    let dateFilter = ''
    const params = []
    
    if (startDate) {
      dateFilter += ' AND f.fee_date >= ?'
      params.push(startDate)
    }
    if (endDate) {
      dateFilter += ' AND f.fee_date <= ?'
      params.push(endDate)
    }
    
    // 按客户汇总费用
    const listQuery = `
      SELECT 
        f.customer_id as customerId,
        f.customer_name as customerName,
        COUNT(DISTINCT f.bill_id) as orderCount,
        COUNT(f.id) as feeCount,
        COALESCE(SUM(f.amount), 0) as totalAmount
      FROM fees f
      WHERE f.customer_id IS NOT NULL ${dateFilter}
      GROUP BY f.customer_id, f.customer_name
      ORDER BY totalAmount DESC
      LIMIT ? OFFSET ?
    `
    const list = db.prepare(listQuery).all(...params, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    // 获取汇总统计
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT f.customer_id) as customerCount,
        COALESCE(SUM(f.amount), 0) as totalRevenue
      FROM fees f
      WHERE f.customer_id IS NOT NULL ${dateFilter}
    `
    const summary = db.prepare(summaryQuery).get(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        list,
        total: summary?.customerCount || 0,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        summary: {
          customerCount: summary?.customerCount || 0,
          totalRevenue: summary?.totalRevenue || 0,
          averageRevenuePerCustomer: summary?.customerCount > 0 ? (summary?.totalRevenue / summary?.customerCount) : 0
        }
      }
    })
  } catch (error) {
    console.error('获取客户报表失败:', error)
    res.json({ errCode: 200, msg: 'success', data: {
      list: [], total: 0, page: 1, pageSize: 20,
      summary: { customerCount: 0, totalRevenue: 0, averageRevenuePerCustomer: 0 }
    }})
  }
})

// 获取发票列表
app.get('/api/invoices', (req, res) => {
  try {
    const { type, status, search, page = 1, pageSize = 20 } = req.query
    let query = 'SELECT * FROM invoices WHERE 1=1'
    const params = []
    
    if (type) {
      query += ' AND invoice_type = ?'
      params.push(type)
    }
    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    if (search) {
      query += ' AND (invoice_number LIKE ? OR customer_name LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }
    
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
    const total = db.prepare(countQuery).get(...params)?.total || 0
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const list = db.prepare(query).all(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        list: list.map(row => ({
          id: row.id,
          invoiceNumber: row.invoice_number,
          invoiceType: row.invoice_type,
          customerName: row.customer_name,
          customerId: row.customer_id,
          totalAmount: row.total_amount,
          paidAmount: row.paid_amount,
          status: row.status,
          dueDate: row.due_date,
          issueDate: row.issue_date,
          notes: row.notes,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
  } catch (error) {
    console.error('获取发票列表失败:', error)
    res.json({ errCode: 200, msg: 'success', data: { list: [], total: 0, page: 1, pageSize: 20 }})
  }
})

// 获取费用列表
app.get('/api/fees', (req, res) => {
  try {
    const { category, billId, customerId, search, page = 1, pageSize = 20 } = req.query
    let query = 'SELECT * FROM fees WHERE 1=1'
    const params = []
    
    if (category) {
      query += ' AND category = ?'
      params.push(category)
    }
    if (billId) {
      query += ' AND bill_id = ?'
      params.push(billId)
    }
    if (customerId) {
      query += ' AND customer_id = ?'
      params.push(customerId)
    }
    if (search) {
      query += ' AND (fee_name LIKE ? OR description LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }
    
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
    const total = db.prepare(countQuery).get(...params)?.total || 0
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const list = db.prepare(query).all(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        list: list.map(row => ({
          id: row.id,
          feeName: row.fee_name,
          category: row.category,
          amount: row.amount,
          billId: row.bill_id,
          billNumber: row.bill_number,
          customerId: row.customer_id,
          customerName: row.customer_name,
          feeDate: row.fee_date,
          description: row.description,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
  } catch (error) {
    console.error('获取费用列表失败:', error)
    res.json({ errCode: 200, msg: 'success', data: { list: [], total: 0, page: 1, pageSize: 20 }})
  }
})

// 获取收付款列表
app.get('/api/payments', (req, res) => {
  try {
    const { type, status, search, page = 1, pageSize = 20 } = req.query
    let query = 'SELECT * FROM payments WHERE 1=1'
    const params = []
    
    if (type) {
      query += ' AND payment_type = ?'
      params.push(type)
    }
    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    if (search) {
      query += ' AND (payment_number LIKE ? OR description LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }
    
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
    const total = db.prepare(countQuery).get(...params)?.total || 0
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const list = db.prepare(query).all(...params)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        list: list.map(row => ({
          id: row.id,
          paymentNumber: row.payment_number,
          paymentType: row.payment_type,
          amount: row.amount,
          paymentMethod: row.payment_method,
          paymentDate: row.payment_date,
          relatedInvoiceId: row.related_invoice_id,
          description: row.description,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
  } catch (error) {
    console.error('获取收付款列表失败:', error)
    res.json({ errCode: 200, msg: 'success', data: { list: [], total: 0, page: 1, pageSize: 20 }})
  }
})

// ==================== TMS运输管理 API ====================

// 获取CMR统计数据
app.get('/api/cmr/stats', (req, res) => {
  try {
    // 待派送: 需要满足完整的订单流转条件（已到港 + 清关放行 + 查验通过）+ 派送状态为待派送
    const pending = db.prepare(`
      SELECT COUNT(*) as count FROM bills_of_lading 
      WHERE status != '草稿' AND (is_void = 0 OR is_void IS NULL)
      AND ship_status = '已到港' 
      AND customs_status = '已放行' 
      AND (inspection = '-' OR inspection = '已放行' OR inspection IS NULL)
      AND delivery_status = '待派送'
    `).get()
    
    const stats = db.prepare(`
      SELECT 
        SUM(CASE WHEN delivery_status = '派送中' THEN 1 ELSE 0 END) as delivering,
        SUM(CASE WHEN delivery_status = '已送达' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN cmr_has_exception = 1 OR delivery_status = '订单异常' OR delivery_status = '异常关闭' THEN 1 ELSE 0 END) as exception
      FROM bills_of_lading
      WHERE status != '草稿' AND (is_void = 0 OR is_void IS NULL)
    `).get()
    
    // 合并统计结果
    stats.pending = pending.count
    
    // 获取派送流程各步骤的订单数量
    // 智能判断：如果 cmr_current_step 没设置，根据 delivery_status 推断
    const stepStats = db.prepare(`
      SELECT 
        SUM(CASE 
          WHEN cmr_current_step = 1 THEN 1 
          ELSE 0 
        END) as step1,
        SUM(CASE 
          WHEN cmr_current_step = 2 THEN 1 
          WHEN (cmr_current_step IS NULL OR cmr_current_step = 0) AND delivery_status = '派送中' THEN 1
          ELSE 0 
        END) as step2,
        SUM(CASE WHEN cmr_current_step = 3 THEN 1 ELSE 0 END) as step3,
        SUM(CASE WHEN cmr_current_step = 4 THEN 1 ELSE 0 END) as step4,
        SUM(CASE 
          WHEN cmr_current_step = 5 THEN 1 
          WHEN (cmr_current_step IS NULL OR cmr_current_step = 0) AND delivery_status = '已送达' THEN 1
          ELSE 0 
        END) as step5
      FROM bills_of_lading
      WHERE (is_void = 0 OR is_void IS NULL) 
        AND (delivery_status = '派送中' OR delivery_status = '已送达')
    `).get()
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        pending: stats?.pending || 0,
        delivering: stats?.delivering || 0,
        delivered: stats?.delivered || 0,
        exception: stats?.exception || 0,
        // 派送流程进度分布
        stepDistribution: {
          step1: stepStats?.step1 || 0,  // 已提货
          step2: stepStats?.step2 || 0,  // 运输中
          step3: stepStats?.step3 || 0,  // 已到达
          step4: stepStats?.step4 || 0,  // 卸货中
          step5: stepStats?.step5 || 0   // 已送达
        }
      }
    })
  } catch (error) {
    console.error('获取CMR统计失败:', error)
    res.json({ errCode: 200, msg: 'success', data: { pending: 0, delivering: 0, delivered: 0, exception: 0, stepDistribution: { step1: 0, step2: 0, step3: 0, step4: 0, step5: 0 } } })
  }
})

// 获取CMR异常订单列表
app.get('/api/cmr/exceptions', (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query
    
    // 获取异常订单列表
    const query = `
      SELECT * FROM bills_of_lading 
      WHERE cmr_has_exception = 1 AND (is_void = 0 OR is_void IS NULL)
      ORDER BY cmr_exception_time DESC
      LIMIT ? OFFSET ?
    `
    const list = db.prepare(query).all(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    // 获取统计数据
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN cmr_exception_status IS NULL OR cmr_exception_status = '' OR cmr_exception_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN cmr_exception_status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN cmr_exception_status = 'closed' OR delivery_status = '异常关闭' THEN 1 ELSE 0 END) as closed
      FROM bills_of_lading
      WHERE cmr_has_exception = 1 AND (is_void = 0 OR is_void IS NULL)
    `).get()
    
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM bills_of_lading 
      WHERE cmr_has_exception = 1 AND (is_void = 0 OR is_void IS NULL)
    `).get().count
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        list: list.map(convertToCamelCase),
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        stats: {
          total: stats?.total || 0,
          pending: stats?.pending || 0,
          processing: stats?.processing || 0,
          closed: stats?.closed || 0
        }
      }
    })
  } catch (error) {
    console.error('获取异常订单列表失败:', error)
    res.status(500).json({ errCode: 500, msg: '获取异常订单列表失败' })
  }
})

// 处理CMR异常
app.post('/api/cmr/:id/resolve-exception', (req, res) => {
  try {
    const { id } = req.params
    const { resolution } = req.body
    
    db.prepare(`
      UPDATE bills_of_lading SET 
        cmr_exception_status = 'resolved',
        cmr_exception_resolution = ?,
        cmr_exception_resolved_time = datetime('now', 'localtime'),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(resolution, id)
    
    res.json({ errCode: 200, msg: 'success' })
  } catch (error) {
    console.error('处理异常失败:', error)
    res.status(500).json({ errCode: 500, msg: '处理异常失败' })
  }
})

// 关闭CMR异常订单
app.post('/api/cmr/:id/close-exception', (req, res) => {
  try {
    const { id } = req.params
    
    db.prepare(`
      UPDATE bills_of_lading SET 
        cmr_exception_status = 'closed',
        delivery_status = '异常关闭',
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(id)
    
    res.json({ errCode: 200, msg: 'success' })
  } catch (error) {
    console.error('关闭异常订单失败:', error)
    res.status(500).json({ errCode: 500, msg: '关闭异常订单失败' })
  }
})

// 注意: CMR列表API已移至 modules/tms/routes.js，使用 tmsRoutes 中的实现

// 获取服务商列表
app.get('/api/service-providers', (req, res) => {
  try {
    const { status, type, search, page = 1, pageSize = 20 } = req.query
    
    let query = 'SELECT * FROM service_providers WHERE 1=1'
    const params = []
    
    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    
    if (type) {
      query += ' AND provider_type = ?'
      params.push(type)
    }
    
    if (search) {
      query += ' AND (provider_name LIKE ? OR contact_person LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }
    
    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
    const total = db.prepare(countQuery).get(...params)?.total || 0
    
    // 分页
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const providers = db.prepare(query).all(...params)
    
    const list = providers.map(p => ({
      id: p.id,
      providerName: p.provider_name,
      providerType: p.provider_type,
      contactPerson: p.contact_person,
      contactPhone: p.contact_phone,
      contactEmail: p.contact_email,
      address: p.address,
      serviceArea: p.service_area,
      status: p.status,
      rating: p.rating,
      notes: p.notes,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }))
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize) }
    })
  } catch (error) {
    console.error('获取服务商列表失败:', error)
    res.json({ errCode: 200, msg: 'success', data: { list: [], total: 0, page: 1, pageSize: 20 } })
  }
})

// 创建服务商
app.post('/api/service-providers', (req, res) => {
  try {
    const data = req.body
    const id = `sp-${Date.now()}`
    
    db.prepare(`
      INSERT INTO service_providers (
        id, provider_name, provider_type, contact_person, contact_phone,
        contact_email, address, service_area, status, rating, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `).run(
      id, data.providerName, data.providerType || 'transport', data.contactPerson,
      data.contactPhone, data.contactEmail, data.address, data.serviceArea,
      'active', data.rating || 0, data.notes
    )
    
    res.json({ errCode: 200, msg: '创建成功', data: { id } })
  } catch (error) {
    console.error('创建服务商失败:', error)
    res.status(500).json({ errCode: 500, msg: '创建服务商失败' })
  }
})

// 更新服务商
app.put('/api/service-providers/:id', (req, res) => {
  try {
    const { id } = req.params
    const data = req.body
    
    db.prepare(`
      UPDATE service_providers SET
        provider_name = COALESCE(?, provider_name),
        provider_type = COALESCE(?, provider_type),
        contact_person = COALESCE(?, contact_person),
        contact_phone = COALESCE(?, contact_phone),
        contact_email = COALESCE(?, contact_email),
        address = COALESCE(?, address),
        service_area = COALESCE(?, service_area),
        status = COALESCE(?, status),
        rating = COALESCE(?, rating),
        notes = COALESCE(?, notes),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      data.providerName, data.providerType, data.contactPerson,
      data.contactPhone, data.contactEmail, data.address, data.serviceArea,
      data.status, data.rating, data.notes, id
    )
    
    res.json({ errCode: 200, msg: '更新成功' })
  } catch (error) {
    console.error('更新服务商失败:', error)
    res.status(500).json({ errCode: 500, msg: '更新服务商失败' })
  }
})

// 删除服务商
app.delete('/api/service-providers/:id', (req, res) => {
  try {
    const { id } = req.params
    db.prepare('DELETE FROM service_providers WHERE id = ?').run(id)
    res.json({ errCode: 200, msg: '删除成功' })
  } catch (error) {
    console.error('删除服务商失败:', error)
    res.status(500).json({ errCode: 500, msg: '删除服务商失败' })
  }
})


// 数据库迁移：添加 air_ports 表的 continent 字段
async function migrateAirPortsContinent() {
  if (!USE_POSTGRES) return
  
  try {
    const db = getDatabase()
    
    // 检查 continent 列是否存在
    const checkColumn = await db.prepare(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'air_ports' AND column_name = 'continent'
    `).get()
    
    if (!checkColumn) {
      console.log('🔄 正在迁移 air_ports 表，添加 continent 字段...')
      
      // 添加 continent 列
      await db.prepare('ALTER TABLE air_ports ADD COLUMN continent TEXT').run()
      
      // 根据 country 从 countries 表填充 continent
      await db.prepare(`
        UPDATE air_ports SET continent = (
          SELECT c.continent FROM countries c WHERE c.country_name_cn = air_ports.country
        )
      `).run()
      
      // 手动补充缺失的国家/地区的洲信息
      await db.prepare(`
        UPDATE air_ports SET continent = '亚洲' 
        WHERE continent IS NULL AND country IN (
          '中国台湾', '中国香港', '以色列', '卡塔尔', '土耳其', 
          '巴林', '沙特阿拉伯', '科威特', '阿曼', '阿联酋'
        )
      `).run()
      
      console.log('✅ air_ports 表 continent 字段迁移完成')
    }
  } catch (error) {
    console.error('⚠️ air_ports 迁移失败:', error.message)
  }
}

// 数据库迁移：统一派送状态值（将"配送中"改为"派送中"）
async function migrateDeliveryStatus() {
  if (!USE_POSTGRES) return
  
  try {
    const db = getDatabase()
    
    // 1. 将"配送中"更新为"派送中"
    const count1 = await db.prepare(`
      SELECT COUNT(*) as count FROM bills_of_lading WHERE delivery_status = '配送中'
    `).get()
    
    if (count1 && count1.count > 0) {
      console.log(`🔄 正在统一派送状态：发现 ${count1.count} 条"配送中"记录，更新为"派送中"...`)
      await db.prepare(`
        UPDATE bills_of_lading SET delivery_status = '派送中' WHERE delivery_status = '配送中'
      `).run()
    }
    
    // 2. 将 NULL、''、'未派送' 更新为 '待派送'
    const count2 = await db.prepare(`
      SELECT COUNT(*) as count FROM bills_of_lading 
      WHERE delivery_status IS NULL OR delivery_status = '' OR delivery_status = '未派送'
    `).get()
    
    if (count2 && count2.count > 0) {
      console.log(`🔄 正在统一待派送状态：发现 ${count2.count} 条空值或"未派送"记录，更新为"待派送"...`)
      await db.prepare(`
        UPDATE bills_of_lading SET delivery_status = '待派送' 
        WHERE delivery_status IS NULL OR delivery_status = '' OR delivery_status = '未派送'
      `).run()
    }
    
    if ((count1 && count1.count > 0) || (count2 && count2.count > 0)) {
      console.log('✅ 派送状态统一完成')
    }
  } catch (error) {
    console.error('⚠️ 派送状态迁移失败:', error.message)
  }
}

// 启动服务器
async function startServer() {
  // PostgreSQL 模式下测试连接
  if (USE_POSTGRES) {
    console.log('🌐 正在连接 PostgreSQL 数据库...')
    const connected = await testConnection()
    if (!connected) {
      console.error('❌ 无法连接到 PostgreSQL 数据库，服务器启动失败')
      process.exit(1)
    }

    // 执行自动数据库迁移（创建新表和字段）
    try {
      await runMigrations()
    } catch (error) {
      console.error('⚠️ 数据库迁移警告:', error.message)
      // 不阻止服务启动，仅警告
    }

    // 执行数据库迁移
    await migrateAirPortsContinent()
    await migrateDeliveryStatus()
  }
  
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`)
    console.log(`API 地址: http://localhost:${PORT}/api`)
    // 根据连接地址判断是本地还是远程数据库
    const dbUrl = process.env.DATABASE_URL || ''
    const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    const dbMode = isLocalDb ? 'PostgreSQL (本地)' : 'PostgreSQL (Render 远程)'
    console.log(`数据库模式: ${dbMode}`)
    
    // 确保上传目录存在
    const uploadDir = join(__dirname, 'uploads')
    try {
      const { mkdirSync } = require('fs')
      mkdirSync(uploadDir, { recursive: true })
    } catch (err) {
      // 目录已存在，忽略错误
    }
    
    // 启动税号自动验证定时任务
    startTaxValidationScheduler()
  })
}

startServer()

