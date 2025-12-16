/**
 * 重置测试数据脚本
 * 清除现有订单和CRM数据，创建相互关联的测试数据
 */

import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const db = new Database(path.join(__dirname, 'data/orders.db'))

// 生成UUID
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

console.log('🗑️  开始清除测试数据...')

// 禁用外键约束
db.pragma('foreign_keys = OFF')

// 清除现有数据（按依赖顺序）
db.exec('DELETE FROM operation_logs')
db.exec('DELETE FROM bill_files')
db.exec('DELETE FROM customer_follow_ups')
db.exec('DELETE FROM customer_contacts')
db.exec('DELETE FROM customer_feedbacks')
db.exec('DELETE FROM quotations')
db.exec('DELETE FROM contracts')
db.exec('DELETE FROM sales_opportunities')
db.exec('DELETE FROM bills_of_lading')
db.exec('DELETE FROM customers')

// 重新启用外键约束
db.pragma('foreign_keys = ON')

console.log('✅ 测试数据已清除')

// ==================== 创建互通测试数据 ====================

console.log('📝 开始创建互通测试数据...')

// 1. 创建客户数据
const customers = [
  {
    id: 'cust001',
    customerCode: 'C20250001',
    customerName: '德邦物流',
    companyName: '德邦物流股份有限公司',
    customerType: 'shipper',
    customerLevel: 'vip',
    contactPerson: '王经理',
    contactPhone: '13800138001',
    contactEmail: 'wang@deppon.com',
    address: '上海市青浦区华新镇',
    countryCode: 'CN',
    status: 'active'
  },
  {
    id: 'cust002',
    customerCode: 'C20250002',
    customerName: 'Euro Trade GmbH',
    companyName: 'Euro Trade Import & Export GmbH',
    customerType: 'consignee',
    customerLevel: 'important',
    contactPerson: 'Hans Mueller',
    contactPhone: '+49 30 12345678',
    contactEmail: 'hans@eurotrade.de',
    address: 'Berlin, Germany',
    countryCode: 'DE',
    status: 'active'
  },
  {
    id: 'cust003',
    customerCode: 'C20250003',
    customerName: '顺丰国际',
    companyName: '顺丰国际物流有限公司',
    customerType: 'both',
    customerLevel: 'vip',
    contactPerson: '李总',
    contactPhone: '13900139001',
    contactEmail: 'li@sf-express.com',
    address: '深圳市南山区科技园',
    countryCode: 'CN',
    status: 'active'
  },
  {
    id: 'cust004',
    customerCode: 'C20250004',
    customerName: 'France Import SARL',
    companyName: 'France Import & Distribution SARL',
    customerType: 'consignee',
    customerLevel: 'normal',
    contactPerson: 'Pierre Dupont',
    contactPhone: '+33 1 23456789',
    contactEmail: 'pierre@franceimport.fr',
    address: 'Paris, France',
    countryCode: 'FR',
    status: 'active'
  },
  {
    id: 'cust005',
    customerCode: 'C20250005',
    customerName: '中远海运',
    companyName: '中国远洋海运集团有限公司',
    customerType: 'shipper',
    customerLevel: 'important',
    contactPerson: '张主管',
    contactPhone: '13700137001',
    contactEmail: 'zhang@cosco.com',
    address: '上海市浦东新区陆家嘴',
    countryCode: 'CN',
    status: 'active'
  }
]

const insertCustomer = db.prepare(`
  INSERT INTO customers (id, customer_code, customer_name, company_name, customer_type, customer_level, 
    contact_person, contact_phone, contact_email, address, country_code, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
`)

customers.forEach(c => {
  insertCustomer.run(c.id, c.customerCode, c.customerName, c.companyName, c.customerType, 
    c.customerLevel, c.contactPerson, c.contactPhone, c.contactEmail, c.address, c.countryCode, c.status)
})
console.log(`✅ 已创建 ${customers.length} 个客户`)

// 2. 创建提单/订单数据（与客户关联）
const bills = [
  {
    id: generateId(),
    billNumber: 'EMCU1234567',
    containerNumber: 'EMCU1234567',
    vessel: 'EVER GIVEN V.2501E',
    eta: '2025-01-15',
    pieces: 120,
    weight: 2500.5,
    volume: 45.8,
    shipper: '德邦物流股份有限公司',
    consignee: 'Euro Trade GmbH',
    portOfLoading: 'CNSHA',
    portOfDischarge: 'DEHAM',
    placeOfDelivery: 'Hamburg, Germany',
    status: 'active',
    shipStatus: '已到港',
    customsStatus: '已放行',
    inspection: '-',
    deliveryStatus: '派送中',
    customerId: 'cust001',
    customerName: '德邦物流',
    customerCode: 'C20250001'
  },
  {
    id: generateId(),
    billNumber: 'COSU8765432',
    containerNumber: 'COSU8765432',
    vessel: 'COSCO SHIPPING LEO V.2502W',
    eta: '2025-01-18',
    pieces: 85,
    weight: 1800.0,
    volume: 32.5,
    shipper: '顺丰国际物流有限公司',
    consignee: 'France Import SARL',
    portOfLoading: 'CNNGB',
    portOfDischarge: 'FRLEH',
    placeOfDelivery: 'Le Havre, France',
    status: 'active',
    shipStatus: '未到港',
    customsStatus: '未放行',
    inspection: '待查验',
    deliveryStatus: '待派送',
    customerId: 'cust003',
    customerName: '顺丰国际',
    customerCode: 'C20250003'
  },
  {
    id: generateId(),
    billNumber: 'MSCU5678901',
    containerNumber: 'MSCU5678901',
    vessel: 'MSC GÜLSÜN V.2503E',
    eta: '2025-01-20',
    pieces: 200,
    weight: 4200.0,
    volume: 68.0,
    shipper: '中国远洋海运集团有限公司',
    consignee: 'Euro Trade GmbH',
    portOfLoading: 'CNSHA',
    portOfDischarge: 'DEBRV',
    placeOfDelivery: 'Bremerhaven, Germany',
    status: 'active',
    shipStatus: '已到港',
    customsStatus: '未放行',
    inspection: '查验中',
    deliveryStatus: '待派送',
    customerId: 'cust005',
    customerName: '中远海运',
    customerCode: 'C20250005'
  },
  {
    id: generateId(),
    billNumber: 'EMCU9876543',
    containerNumber: 'EMCU9876543',
    vessel: 'EVER ACE V.2504W',
    eta: '2025-01-10',
    pieces: 50,
    weight: 950.0,
    volume: 18.5,
    shipper: '德邦物流股份有限公司',
    consignee: 'France Import SARL',
    portOfLoading: 'CNTAO',
    portOfDischarge: 'NLRTM',
    placeOfDelivery: 'Rotterdam, Netherlands',
    status: 'active',
    shipStatus: '已到港',
    customsStatus: '已放行',
    inspection: '已放行',
    deliveryStatus: '已送达',
    customerId: 'cust001',
    customerName: '德邦物流',
    customerCode: 'C20250001'
  },
  {
    id: generateId(),
    billNumber: 'COSU1122334',
    containerNumber: 'COSU1122334',
    vessel: 'COSCO PRIDE V.2505E',
    eta: '2025-01-25',
    pieces: 150,
    weight: 3100.0,
    volume: 52.0,
    shipper: '顺丰国际物流有限公司',
    consignee: 'Euro Trade GmbH',
    portOfLoading: 'CNSHA',
    portOfDischarge: 'DEHAM',
    placeOfDelivery: 'Hamburg, Germany',
    status: 'active',
    shipStatus: '未到港',
    customsStatus: '未放行',
    inspection: '-',
    deliveryStatus: '待派送',
    customerId: 'cust003',
    customerName: '顺丰国际',
    customerCode: 'C20250003'
  },
  {
    id: generateId(),
    billNumber: 'HLCU4455667',
    containerNumber: 'HLCU4455667',
    vessel: 'HAPAG HAMBURG V.2506W',
    eta: '2025-01-22',
    pieces: 75,
    weight: 1650.0,
    volume: 28.0,
    shipper: '中国远洋海运集团有限公司',
    consignee: 'France Import SARL',
    portOfLoading: 'CNNGB',
    portOfDischarge: 'FRLEH',
    placeOfDelivery: 'Paris, France',
    status: 'active',
    shipStatus: '已到港',
    customsStatus: '已放行',
    inspection: '-',
    deliveryStatus: '派送中',
    customerId: 'cust005',
    customerName: '中远海运',
    customerCode: 'C20250005'
  }
]

const insertBill = db.prepare(`
  INSERT INTO bills_of_lading (id, bill_number, container_number, vessel, eta, pieces, weight, volume,
    shipper, consignee, port_of_loading, port_of_discharge, place_of_delivery, status, ship_status,
    customs_status, inspection, delivery_status, customer_id, customer_name, customer_code,
    created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
`)

bills.forEach(b => {
  insertBill.run(b.id, b.billNumber, b.containerNumber, b.vessel, b.eta, b.pieces, b.weight, b.volume,
    b.shipper, b.consignee, b.portOfLoading, b.portOfDischarge, b.placeOfDelivery, b.status, 
    b.shipStatus, b.customsStatus, b.inspection, b.deliveryStatus, b.customerId, b.customerName, b.customerCode)
})
console.log(`✅ 已创建 ${bills.length} 个订单（已关联客户）`)

// 3. 创建客户跟进记录
const followUps = [
  { id: generateId(), customerId: 'cust001', type: 'phone', content: '电话沟通新航线报价，客户表示有兴趣' },
  { id: generateId(), customerId: 'cust001', type: 'email', content: '发送最新运价表和服务说明' },
  { id: generateId(), customerId: 'cust003', type: 'meeting', content: '线下会议讨论年度合作框架' },
  { id: generateId(), customerId: 'cust005', type: 'visit', content: '拜访客户总部，介绍新增欧洲航线' },
]

const insertFollowUp = db.prepare(`
  INSERT INTO customer_follow_ups (id, customer_id, follow_up_type, follow_up_time, content, operator_name, created_at)
  VALUES (?, ?, ?, datetime('now', 'localtime'), ?, '系统管理员', datetime('now', 'localtime'))
`)

followUps.forEach(f => {
  insertFollowUp.run(f.id, f.customerId, f.type, f.content)
})
console.log(`✅ 已创建 ${followUps.length} 条跟进记录`)

// 4. 创建销售机会
const opportunities = [
  { id: generateId(), name: '德邦物流年度合作', customerId: 'cust001', customerName: '德邦物流', stage: 'negotiation', amount: 500000, probability: 70 },
  { id: generateId(), name: '顺丰国际欧洲航线', customerId: 'cust003', customerName: '顺丰国际', stage: 'proposal', amount: 300000, probability: 50 },
  { id: generateId(), name: '中远海运整柜运输', customerId: 'cust005', customerName: '中远海运', stage: 'closed_won', amount: 180000, probability: 100 },
]

const insertOpportunity = db.prepare(`
  INSERT INTO sales_opportunities (id, opportunity_name, customer_id, customer_name, stage, expected_amount, probability, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
`)

opportunities.forEach(o => {
  insertOpportunity.run(o.id, o.name, o.customerId, o.customerName, o.stage, o.amount, o.probability)
})
console.log(`✅ 已创建 ${opportunities.length} 个销售机会`)

// 5. 创建操作日志（为订单添加）
const billIds = db.prepare('SELECT id, bill_number FROM bills_of_lading').all()
const insertLog = db.prepare(`
  INSERT INTO operation_logs (bill_id, operation_type, operation_name, operator, remark, operation_time, created_at)
  VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
`)

billIds.forEach(bill => {
  insertLog.run(bill.id, 'create', '创建订单', '系统', `创建提单 ${bill.bill_number}`)
})
console.log(`✅ 已创建 ${billIds.length} 条操作日志`)

// 统计数据
const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get()
const billCount = db.prepare('SELECT COUNT(*) as count FROM bills_of_lading').get()
const linkedBillCount = db.prepare("SELECT COUNT(*) as count FROM bills_of_lading WHERE customer_id IS NOT NULL AND customer_id != ''").get()

// 查询每个客户的订单数量
const customerOrderCounts = db.prepare(
  "SELECT c.customer_name as customerName, c.customer_level as customerLevel, COUNT(b.id) as orderCount FROM customers c LEFT JOIN bills_of_lading b ON c.id = b.customer_id GROUP BY c.id ORDER BY orderCount DESC"
).all()

console.log('')
console.log('╔════════════════════════════════════════════════════════════╗')
console.log('║           📊 测试数据创建完成                              ║')
console.log('╠════════════════════════════════════════════════════════════╣')
console.log(`║  客户总数: ${customerCount.count}                                              ║`)
console.log(`║  订单总数: ${billCount.count}                                              ║`)
console.log(`║  关联订单: ${linkedBillCount.count} (100% 已关联客户)                         ║`)
console.log('╠════════════════════════════════════════════════════════════╣')
console.log('║  客户-订单关联明细:                                        ║')
customerOrderCounts.forEach(row => {
  const levelLabel = row.customerLevel === 'vip' ? 'VIP' : 
                     row.customerLevel === 'important' ? '重要' : '普通'
  console.log(`║  • ${row.customerName.padEnd(15)} (${levelLabel}) → ${row.orderCount}个订单          ║`)
})
console.log('╚════════════════════════════════════════════════════════════╝')

db.close()
console.log('')
console.log('✅ 测试数据重置完成！')

