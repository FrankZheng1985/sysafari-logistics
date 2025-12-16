/**
 * 插入测试数据脚本
 * 根据现有订单数据创建关联的客户、费用、发票、付款、运输数据
 */

import pg from 'pg'
import dotenv from 'dotenv'

const { Pool } = pg
dotenv.config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://fengzheng@localhost/sysafari_dev'
})

async function insertTestData() {
  const client = await pool.connect()
  
  try {
    console.log('🚀 开始插入测试数据...\n')
    
    // ========== 1. 插入客户数据 ==========
    console.log('📋 插入客户数据...')
    const customers = [
      { id: 'cust-001', code: 'C20250001', name: '上海国际贸易有限公司', type: 'shipper', level: 'vip', contact: '张经理', phone: '13800138001', email: 'zhang@shanghai-trade.com' },
      { id: 'cust-002', code: 'C20250002', name: '深圳电子科技股份有限公司', type: 'shipper', level: 'vip', contact: '李总', phone: '13800138002', email: 'li@shenzhen-tech.com' },
      { id: 'cust-003', code: 'C20250003', name: '宁波港航物流集团', type: 'consignee', level: 'normal', contact: '王主管', phone: '13800138003', email: 'wang@ningbo-shipping.com' },
      { id: 'cust-004', code: 'C20250004', name: '广州汽车零部件有限公司', type: 'shipper', level: 'normal', contact: '陈经理', phone: '13800138004', email: 'chen@guangzhou-auto.com' },
      { id: 'cust-005', code: 'C20250005', name: '青岛海洋食品进出口公司', type: 'shipper', level: 'potential', contact: '刘主任', phone: '13800138005', email: 'liu@qingdao-food.com' },
      { id: 'cust-006', code: 'C20250006', name: '天津重工机械制造有限公司', type: 'consignee', level: 'normal', contact: '赵工', phone: '13800138006', email: 'zhao@tianjin-machine.com' },
      { id: 'cust-007', code: 'C20250007', name: '苏州纺织品出口公司', type: 'shipper', level: 'vip', contact: '周经理', phone: '13800138007', email: 'zhou@suzhou-textile.com' },
      { id: 'cust-008', code: 'C20250008', name: '大连化工集团', type: 'shipper', level: 'normal', contact: '吴总', phone: '13800138008', email: 'wu@dalian-chem.com' },
      { id: 'cust-009', code: 'C20250009', name: '厦门塑胶制品有限公司', type: 'consignee', level: 'potential', contact: '郑经理', phone: '13800138009', email: 'zheng@xiamen-plastic.com' },
      { id: 'cust-010', code: 'C20250010', name: '杭州丝绸文化有限公司', type: 'shipper', level: 'normal', contact: '孙主管', phone: '13800138010', email: 'sun@hangzhou-silk.com' }
    ]
    
    for (const c of customers) {
      await client.query(`
        INSERT INTO customers (id, customer_code, customer_name, customer_type, customer_level, contact_person, contact_phone, contact_email, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW())
        ON CONFLICT (id) DO UPDATE SET customer_name = EXCLUDED.customer_name
      `, [c.id, c.code, c.name, c.type, c.level, c.contact, c.phone, c.email])
    }
    console.log(`  ✅ 已插入 ${customers.length} 条客户数据\n`)

    // ========== 2. 插入费用数据 ==========
    console.log('💰 插入费用数据...')
    const fees = [
      // 应收费用 (receivable) - 向客户收取
      { id: 'fee-001', number: 'FEE20250001', bill_id: 'bl-001', bill_number: 'BP2500001', customer_id: 'cust-001', customer_name: '上海国际贸易有限公司', type: 'receivable', category: 'freight', name: '海运费', amount: 15000, currency: 'EUR', status: 'unpaid' },
      { id: 'fee-002', number: 'FEE20250002', bill_id: 'bl-001', bill_number: 'BP2500001', customer_id: 'cust-001', customer_name: '上海国际贸易有限公司', type: 'receivable', category: 'clearance', name: '报关费', amount: 800, currency: 'EUR', status: 'paid' },
      { id: 'fee-003', number: 'FEE20250003', bill_id: 'bl-003', bill_number: 'BP2500003', customer_id: 'cust-002', customer_name: '深圳电子科技股份有限公司', type: 'receivable', category: 'freight', name: '海运费', amount: 22000, currency: 'EUR', status: 'unpaid' },
      { id: 'fee-004', number: 'FEE20250004', bill_id: 'bl-003', bill_number: 'BP2500003', customer_id: 'cust-002', customer_name: '深圳电子科技股份有限公司', type: 'receivable', category: 'handling', name: '操作费', amount: 500, currency: 'EUR', status: 'paid' },
      { id: 'fee-005', number: 'FEE20250005', bill_id: 'bl-007', bill_number: 'BP2500007', customer_id: 'cust-004', customer_name: '广州汽车零部件有限公司', type: 'receivable', category: 'freight', name: '海运费', amount: 18500, currency: 'EUR', status: 'partial' },
      { id: 'fee-006', number: 'FEE20250006', bill_id: 'bl-009', bill_number: 'BP2500009', customer_id: 'cust-005', customer_name: '青岛海洋食品进出口公司', type: 'receivable', category: 'freight', name: '海运费', amount: 12000, currency: 'EUR', status: 'unpaid' },
      { id: 'fee-007', number: 'FEE20250007', bill_id: 'bl-013', bill_number: 'BP2500013', customer_id: 'cust-007', customer_name: '苏州纺织品出口公司', type: 'receivable', category: 'freight', name: '海运费', amount: 25000, currency: 'EUR', status: 'paid' },
      
      // 应付费用 (payable) - 支付给供应商
      { id: 'fee-008', number: 'FEE20250008', bill_id: 'bl-001', bill_number: 'BP2500001', customer_id: null, customer_name: '马士基航运', type: 'payable', category: 'freight', name: '船公司运费', amount: 12000, currency: 'EUR', status: 'paid' },
      { id: 'fee-009', number: 'FEE20250009', bill_id: 'bl-003', bill_number: 'BP2500003', customer_id: null, customer_name: '中远海运', type: 'payable', category: 'freight', name: '船公司运费', amount: 18000, currency: 'EUR', status: 'unpaid' },
      { id: 'fee-010', number: 'FEE20250010', bill_id: 'bl-007', bill_number: 'BP2500007', customer_id: null, customer_name: '长荣海运', type: 'payable', category: 'freight', name: '船公司运费', amount: 15000, currency: 'EUR', status: 'paid' },
      { id: 'fee-011', number: 'FEE20250011', bill_id: 'bl-009', bill_number: 'BP2500009', customer_id: null, customer_name: 'ONE航运', type: 'payable', category: 'freight', name: '船公司运费', amount: 9500, currency: 'EUR', status: 'unpaid' },
      { id: 'fee-012', number: 'FEE20250012', bill_id: 'bl-013', bill_number: 'BP2500013', customer_id: null, customer_name: '马士基航运', type: 'payable', category: 'freight', name: '船公司运费', amount: 20000, currency: 'EUR', status: 'paid' }
    ]
    
    for (const f of fees) {
      const paidAmount = f.status === 'paid' ? f.amount : (f.status === 'partial' ? f.amount * 0.5 : 0)
      const unpaidAmount = f.amount - paidAmount
      await client.query(`
        INSERT INTO fees (id, fee_number, bill_id, bill_number, customer_id, customer_name, fee_type, fee_category, category, fee_name, amount, currency, amount_cny, total_amount, paid_amount, unpaid_amount, payment_status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, $10, $10, $12, $13, $14, NOW())
        ON CONFLICT (id) DO UPDATE SET fee_name = EXCLUDED.fee_name
      `, [f.id, f.number, f.bill_id, f.bill_number, f.customer_id, f.customer_name, f.type, f.category, f.name, f.amount, f.currency, paidAmount, unpaidAmount, f.status])
    }
    console.log(`  ✅ 已插入 ${fees.length} 条费用数据\n`)

    // ========== 3. 插入发票数据 ==========
    console.log('📄 插入发票数据...')
    const invoices = [
      { id: 'inv-001', number: 'INV20250001', type: 'sales', customer_id: 'cust-001', customer_name: '上海国际贸易有限公司', subtotal: 15800, tax_rate: 0.06, status: 'paid' },
      { id: 'inv-002', number: 'INV20250002', type: 'sales', customer_id: 'cust-002', customer_name: '深圳电子科技股份有限公司', subtotal: 22500, tax_rate: 0.06, status: 'unpaid' },
      { id: 'inv-003', number: 'INV20250003', type: 'sales', customer_id: 'cust-004', customer_name: '广州汽车零部件有限公司', subtotal: 18500, tax_rate: 0.06, status: 'partial' },
      { id: 'inv-004', number: 'INV20250004', type: 'sales', customer_id: 'cust-007', customer_name: '苏州纺织品出口公司', subtotal: 25000, tax_rate: 0.06, status: 'paid' },
      { id: 'inv-005', number: 'INV20250005', type: 'purchase', customer_id: null, customer_name: '马士基航运', subtotal: 32000, tax_rate: 0.06, status: 'paid' },
      { id: 'inv-006', number: 'INV20250006', type: 'purchase', customer_id: null, customer_name: '中远海运', subtotal: 18000, tax_rate: 0.06, status: 'unpaid' }
    ]
    
    for (const inv of invoices) {
      const taxAmount = inv.subtotal * inv.tax_rate
      const totalAmount = inv.subtotal + taxAmount
      const paidAmount = inv.status === 'paid' ? totalAmount : (inv.status === 'partial' ? totalAmount * 0.6 : 0)
      await client.query(`
        INSERT INTO invoices (id, invoice_number, invoice_type, customer_id, customer_name, invoice_date, due_date, subtotal, tax_rate, tax_amount, total_amount, paid_amount, status, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '20 days', $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (id) DO UPDATE SET invoice_number = EXCLUDED.invoice_number
      `, [inv.id, inv.number, inv.type, inv.customer_id, inv.customer_name, inv.subtotal, inv.tax_rate, taxAmount, totalAmount, paidAmount, inv.status])
    }
    console.log(`  ✅ 已插入 ${invoices.length} 条发票数据\n`)

    // ========== 4. 插入付款记录 ==========
    console.log('💳 插入付款记录...')
    const payments = [
      { id: 'pay-001', number: 'PAY20250001', type: 'receipt', customer_id: 'cust-001', customer_name: '上海国际贸易有限公司', invoice_id: 'inv-001', invoice_number: 'INV20250001', amount: 16748, method: 'bank_transfer', status: 'confirmed' },
      { id: 'pay-002', number: 'PAY20250002', type: 'receipt', customer_id: 'cust-002', customer_name: '深圳电子科技股份有限公司', invoice_id: null, invoice_number: null, amount: 500, method: 'bank_transfer', status: 'confirmed' },
      { id: 'pay-003', number: 'PAY20250003', type: 'receipt', customer_id: 'cust-004', customer_name: '广州汽车零部件有限公司', invoice_id: 'inv-003', invoice_number: 'INV20250003', amount: 11766, method: 'bank_transfer', status: 'confirmed' },
      { id: 'pay-004', number: 'PAY20250004', type: 'receipt', customer_id: 'cust-007', customer_name: '苏州纺织品出口公司', invoice_id: 'inv-004', invoice_number: 'INV20250004', amount: 26500, method: 'bank_transfer', status: 'confirmed' },
      { id: 'pay-005', number: 'PAY20250005', type: 'payment', customer_id: null, customer_name: '马士基航运', invoice_id: 'inv-005', invoice_number: 'INV20250005', amount: 33920, method: 'bank_transfer', status: 'confirmed' },
      { id: 'pay-006', number: 'PAY20250006', type: 'payment', customer_id: null, customer_name: '长荣海运', invoice_id: null, invoice_number: null, amount: 15000, method: 'bank_transfer', status: 'confirmed' }
    ]
    
    for (const p of payments) {
      await client.query(`
        INSERT INTO payments (id, payment_number, payment_type, customer_id, customer_name, invoice_id, invoice_number, payment_date, amount, payment_method, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE - INTERVAL '5 days', $8, $9, $10, NOW())
        ON CONFLICT (id) DO UPDATE SET payment_number = EXCLUDED.payment_number
      `, [p.id, p.number, p.type, p.customer_id, p.customer_name, p.invoice_id, p.invoice_number, p.amount, p.method, p.status])
    }
    console.log(`  ✅ 已插入 ${payments.length} 条付款记录\n`)

    // ========== 5. 插入运输订单 ==========
    console.log('🚚 插入运输订单...')
    const lastMileOrders = [
      { id: 'lm-001', order_number: 'LM20250001', bill_id: 'bl-001', bill_number: 'BP2500001', recipient: '张先生', address: '上海市浦东新区张江高科技园区', phone: '13900139001', company: '顺丰速运', tracking: 'SF1234567890', status: '已送达' },
      { id: 'lm-002', order_number: 'LM20250002', bill_id: 'bl-003', bill_number: 'BP2500003', recipient: '李经理', address: '深圳市南山区科技园', phone: '13900139002', company: '德邦物流', tracking: 'DB9876543210', status: '派送中' },
      { id: 'lm-003', order_number: 'LM20250003', bill_id: 'bl-007', bill_number: 'BP2500007', recipient: '陈主管', address: '广州市天河区体育西路', phone: '13900139003', company: '中通快递', tracking: 'ZT2468135790', status: '派送中' },
      { id: 'lm-004', order_number: 'LM20250004', bill_id: 'bl-009', bill_number: 'BP2500009', recipient: '王总', address: '青岛市崂山区海尔路', phone: '13900139004', company: '京东物流', tracking: 'JD1357924680', status: '待派送' },
      { id: 'lm-005', order_number: 'LM20250005', bill_id: 'bl-011', bill_number: 'BP2500011', recipient: '赵工', address: '天津市滨海新区经济开发区', phone: '13900139005', company: '顺丰速运', tracking: 'SF0987654321', status: '待派送' },
      { id: 'lm-006', order_number: 'LM20250006', bill_id: 'bl-013', bill_number: 'BP2500013', recipient: '周经理', address: '苏州市工业园区金鸡湖大道', phone: '13900139006', company: '德邦物流', tracking: 'DB1122334455', status: '已送达' }
    ]
    
    for (const lm of lastMileOrders) {
      await client.query(`
        INSERT INTO last_mile_orders (id, order_number, bill_id, bill_number, recipient_name, recipient_address, recipient_phone, delivery_company, tracking_number, status, creator, create_time, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'admin', NOW()::text, NOW())
        ON CONFLICT (id) DO UPDATE SET order_number = EXCLUDED.order_number
      `, [lm.id, lm.order_number, lm.bill_id, lm.bill_number, lm.recipient, lm.address, lm.phone, lm.company, lm.tracking, lm.status])
    }
    console.log(`  ✅ 已插入 ${lastMileOrders.length} 条运输订单\n`)

    // ========== 6. 插入销售机会 ==========
    console.log('📊 插入销售机会...')
    const opportunities = [
      { id: 'opp-001', name: '上海贸易年度合同', customer_id: 'cust-001', customer_name: '上海国际贸易有限公司', amount: 500000, stage: 'won', probability: 100 },
      { id: 'opp-002', name: '深圳电子出口项目', customer_id: 'cust-002', customer_name: '深圳电子科技股份有限公司', amount: 350000, stage: 'negotiation', probability: 70 },
      { id: 'opp-003', name: '宁波物流合作', customer_id: 'cust-003', customer_name: '宁波港航物流集团', amount: 200000, stage: 'proposal', probability: 50 },
      { id: 'opp-004', name: '广州汽配季度单', customer_id: 'cust-004', customer_name: '广州汽车零部件有限公司', amount: 180000, stage: 'won', probability: 100 },
      { id: 'opp-005', name: '苏州纺织品年度合同', customer_id: 'cust-007', customer_name: '苏州纺织品出口公司', amount: 420000, stage: 'won', probability: 100 }
    ]
    
    for (const opp of opportunities) {
      await client.query(`
        INSERT INTO sales_opportunities (id, opportunity_name, customer_id, customer_name, expected_amount, stage, probability, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (id) DO UPDATE SET opportunity_name = EXCLUDED.opportunity_name
      `, [opp.id, opp.name, opp.customer_id, opp.customer_name, opp.amount, opp.stage, opp.probability])
    }
    console.log(`  ✅ 已插入 ${opportunities.length} 条销售机会\n`)

    // ========== 7. 插入客户反馈 ==========
    console.log('💬 插入客户反馈...')
    const feedbacks = [
      { id: 'fb-001', customer_id: 'cust-001', customer_name: '上海国际贸易有限公司', type: 'complaint', subject: '货物延迟问题', content: '上周的货物比预期晚到了3天', status: 'resolved', priority: 'high' },
      { id: 'fb-002', customer_id: 'cust-002', customer_name: '深圳电子科技股份有限公司', type: 'suggestion', subject: '希望增加在线追踪功能', content: '建议开发实时货物追踪系统', status: 'processing', priority: 'medium' },
      { id: 'fb-003', customer_id: 'cust-004', customer_name: '广州汽车零部件有限公司', type: 'inquiry', subject: '关于运费报价', content: '需要了解大宗货物的运费优惠政策', status: 'open', priority: 'low' },
      { id: 'fb-004', customer_id: 'cust-007', customer_name: '苏州纺织品出口公司', type: 'praise', subject: '服务表扬', content: '对本次运输服务非常满意，感谢团队的专业服务', status: 'closed', priority: 'low' }
    ]
    
    for (const fb of feedbacks) {
      await client.query(`
        INSERT INTO customer_feedbacks (id, customer_id, customer_name, feedback_type, subject, content, status, priority, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (id) DO UPDATE SET subject = EXCLUDED.subject
      `, [fb.id, fb.customer_id, fb.customer_name, fb.type, fb.subject, fb.content, fb.status, fb.priority])
    }
    console.log(`  ✅ 已插入 ${feedbacks.length} 条客户反馈\n`)

    console.log('🎉 所有测试数据插入完成！\n')
    
    // 显示统计
    console.log('📈 数据统计:')
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM customers) as customers,
        (SELECT COUNT(*) FROM fees) as fees,
        (SELECT COUNT(*) FROM invoices) as invoices,
        (SELECT COUNT(*) FROM payments) as payments,
        (SELECT COUNT(*) FROM last_mile_orders) as last_mile_orders,
        (SELECT COUNT(*) FROM sales_opportunities) as opportunities,
        (SELECT COUNT(*) FROM customer_feedbacks) as feedbacks
    `)
    console.log(`  - 客户: ${stats.rows[0].customers} 条`)
    console.log(`  - 费用: ${stats.rows[0].fees} 条`)
    console.log(`  - 发票: ${stats.rows[0].invoices} 条`)
    console.log(`  - 付款: ${stats.rows[0].payments} 条`)
    console.log(`  - 运输订单: ${stats.rows[0].last_mile_orders} 条`)
    console.log(`  - 销售机会: ${stats.rows[0].opportunities} 条`)
    console.log(`  - 客户反馈: ${stats.rows[0].feedbacks} 条`)
    
  } catch (error) {
    console.error('❌ 插入数据失败:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

insertTestData().catch(console.error)

