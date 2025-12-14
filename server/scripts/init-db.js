import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '..', 'data', 'orders.db')
const db = new Database(dbPath)

// 初始化数据库表
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// 创建索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_bill_number ON bills_of_lading(bill_number);
  CREATE INDEX IF NOT EXISTS idx_container_number ON bills_of_lading(container_number);
  CREATE INDEX IF NOT EXISTS idx_status ON bills_of_lading(status);
  CREATE INDEX IF NOT EXISTS idx_create_time ON bills_of_lading(create_time);
`)

// 检查是否已有订单数据，避免重复插入测试数据
const existingCount = db.prepare('SELECT COUNT(*) as count FROM bills_of_lading').get()

if (existingCount.count === 0) {
  console.log('数据库为空，跳过测试数据导入（请使用 reset-test-data.js 创建测试数据）')
} else {
  console.log(`数据库已有 ${existingCount.count} 条订单数据，跳过测试数据导入`)
}

console.log('数据库初始化完成')
db.close()

