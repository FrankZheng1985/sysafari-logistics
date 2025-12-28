/**
 * 执行清关服务报价导入脚本
 * 将 2025-12-16 生效的报价表导入到欧洲自税清关服务产品
 */

import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

// 数据库连接
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_TEST

if (!DATABASE_URL) {
  console.error('❌ 未配置数据库连接字符串 DATABASE_URL')
  process.exit(1)
}

async function importClearancePrices() {
  const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
  
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: isLocalhost ? false : { rejectUnauthorized: false }
  })

  const client = await pool.connect()
  
  try {
    console.log('📦 开始导入欧洲自税清关服务报价...')
    console.log('📍 数据库:', isLocalhost ? '本地' : '远程')
    
    // 开始事务
    await client.query('BEGIN')
    
    // 产品ID
    const productId = 'ed0d483d-7693-480d-be6c-ed668e2fa620'
    
    // 先检查产品是否存在
    const productCheck = await client.query(
      'SELECT id, product_name FROM products WHERE id = $1',
      [productId]
    )
    
    if (productCheck.rows.length === 0) {
      console.log('⚠️ 产品不存在，正在创建...')
      await client.query(`
        INSERT INTO products (id, product_code, product_name, product_name_en, category, description, is_active, sort_order, created_at, updated_at)
        VALUES ($1, 'PRD0004', '欧洲自税清关服务', 'European self-tax customs clearance services', '清关服务', '', 1, 0, NOW(), NOW())
      `, [productId])
      console.log('✅ 产品创建成功')
    } else {
      console.log(`✅ 找到产品: ${productCheck.rows[0].product_name}`)
    }
    
    // 获取当前费用项数量
    const beforeCount = await client.query(
      'SELECT COUNT(*) as count FROM product_fee_items WHERE product_id = $1',
      [productId]
    )
    console.log(`📊 导入前费用项数量: ${beforeCount.rows[0].count}`)
    
    // 删除现有费用项
    const deleteResult = await client.query(
      'DELETE FROM product_fee_items WHERE product_id = $1',
      [productId]
    )
    console.log(`🗑️ 已删除 ${deleteResult.rowCount} 个旧费用项`)
    
    // 费用项数据（根据PDF报价表）
    const feeItems = [
      // ==================== 海运整柜/铁路整柜进口操作 ====================
      { fee_name: '码头处理费（THC）ISPS 20FT', fee_name_en: 'THC ISPS 20FT (Sea Only)', fee_category: '港口费用', unit: '柜', standard_price: 0, description: '仅限海运，实报实销', billing_type: 'actual', cost_price: 0, sort_order: 1 },
      { fee_name: '码头处理费（THC）ISPS 40FT/HQ', fee_name_en: 'THC ISPS 40FT/HQ (Sea Only)', fee_category: '港口费用', unit: '柜', standard_price: 0, description: '仅限海运，实报实销', billing_type: 'actual', cost_price: 0, sort_order: 2 },
      { fee_name: '码头处理费（THC）ISPS 45FT/HQ', fee_name_en: 'THC ISPS 45FT/HQ (Sea Only)', fee_category: '港口费用', unit: '柜', standard_price: 0, description: '仅限海运，实报实销', billing_type: 'actual', cost_price: 0, sort_order: 3 },
      { fee_name: '提单管理费', fee_name_en: 'B/L Management Fee', fee_category: '文件费', unit: '提单/订单', standard_price: 60, description: '', billing_type: 'fixed', cost_price: 50, is_required: true, sort_order: 4 },
      
      // ==================== 海运、铁路、卡航清关和递延服务 ====================
      { fee_name: '关税', fee_name_en: 'Import Duties', fee_category: '税务费', unit: '清关申报', standard_price: 0, description: '实报实销', billing_type: 'actual', cost_price: 0, sort_order: 10 },
      { fee_name: '本土清关费', fee_name_en: 'Local Customs Clearance Fee', fee_category: '清关服务', unit: '提单/订单', standard_price: 155, description: '含10个HS Code', billing_type: 'fixed', cost_price: 100, sort_order: 11 },
      { fee_name: '离岸税号清关费', fee_name_en: 'Offshore Tax ID Clearance Fee', fee_category: '清关服务', unit: '提单/订单', standard_price: 175, description: '含10个HS Code', billing_type: 'fixed', cost_price: 150, sort_order: 12 },
      { fee_name: '多柜附加清关费', fee_name_en: 'Additional Container Clearance Fee', fee_category: '清关服务', unit: '每柜', standard_price: 155, description: '一个提单多个柜子，第二个柜子起', billing_type: 'fixed', cost_price: 100, sort_order: 13 },
      { fee_name: '税务代理服务', fee_name_en: 'Tax Agency Service', fee_category: '清关服务', unit: '清关申报', standard_price: 200, description: '', billing_type: 'fixed', cost_price: 150, is_required: true, sort_order: 14 },
      { fee_name: '多个进口VAT申报', fee_name_en: 'Multiple Import VAT Declaration', fee_category: '税务费', unit: '每分单', standard_price: 155, description: '', billing_type: 'fixed', cost_price: 100, sort_order: 15 },
      { fee_name: '进口商服务费', fee_name_en: 'Importer Service Fee', fee_category: '清关服务', unit: '票', standard_price: 800, description: '', billing_type: 'fixed', cost_price: 600, sort_order: 16 },
      
      // ==================== 额外费用 ====================
      { fee_name: '提前X光扫描', fee_name_en: 'Pre-arrival X-ray Scanning', fee_category: '查验费用', unit: '柜', standard_price: 750, description: '到港前的海关查验', billing_type: 'fixed', cost_price: 600, sort_order: 20 },
      { fee_name: '海关申报查验协助费', fee_name_en: 'Customs Declaration Inspection Assistance', fee_category: '查验费用', unit: '产品', standard_price: 60, description: '', billing_type: 'fixed', cost_price: 40, sort_order: 21 },
      { fee_name: '集装箱气体检测', fee_name_en: 'Container Gas Testing', fee_category: '查验费用', unit: '柜', standard_price: 0, description: '实报实销', billing_type: 'actual', cost_price: 0, sort_order: 22 },
      { fee_name: '仓库查验费', fee_name_en: 'Warehouse Inspection Fee', fee_category: '查验费用', unit: '柜', standard_price: 650, description: '卸柜费', billing_type: 'fixed', cost_price: 500, sort_order: 23 },
      { fee_name: '安排T1文件', fee_name_en: 'T1 Document Arrangement', fee_category: '文件费', unit: '文件', standard_price: 85, description: '', billing_type: 'fixed', cost_price: 60, sort_order: 24 },
      { fee_name: '海关罚款', fee_name_en: 'Customs Penalty', fee_category: '罚款', unit: '案件', standard_price: 0, description: '实报实销', billing_type: 'actual', cost_price: 0, sort_order: 25 },
      { fee_name: '文件错误/违规申报处理费', fee_name_en: 'Document Error/Customs Violation Fee', fee_category: '罚款', unit: '案件', standard_price: 250, description: '瞒报及其他海关违规申报', billing_type: 'fixed', cost_price: 200, sort_order: 26 },
      { fee_name: '海关重新申报', fee_name_en: 'Customs Re-declaration', fee_category: '清关服务', unit: '清关申报', standard_price: 180, description: '', billing_type: 'fixed', cost_price: 120, sort_order: 27 },
      { fee_name: '额外HS Code费', fee_name_en: 'Additional HS Code Fee', fee_category: '文件费', unit: 'HS Code', standard_price: 8, description: '10个以上HS Code，每个', billing_type: 'fixed', cost_price: 6, sort_order: 28 },
      { fee_name: '清关咨询费', fee_name_en: 'Customs Consultation Fee', fee_category: '服务费', unit: '小时', standard_price: 120, description: '清关事宜人工咨询', billing_type: 'fixed', cost_price: 80, sort_order: 29 },
      { fee_name: '卡车停靠清关费', fee_name_en: 'Truck Parking Clearance Fee', fee_category: '清关服务', unit: '车', standard_price: 100, description: '', billing_type: 'fixed', cost_price: 70, sort_order: 30 },
    ]
    
    // 插入费用项
    let insertCount = 0
    for (const item of feeItems) {
      await client.query(`
        INSERT INTO product_fee_items (
          product_id, fee_name, fee_name_en, fee_category, unit, 
          standard_price, currency, is_required, description, billing_type, 
          cost_price, profit_type, profit_value, sort_order, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'EUR', $7, $8, $9, $10, 'amount', $11, $12, NOW(), NOW())
      `, [
        productId,
        item.fee_name,
        item.fee_name_en,
        item.fee_category,
        item.unit,
        item.standard_price,
        item.is_required ? 1 : 0,
        item.description || '',
        item.billing_type,
        item.cost_price || 0,
        item.standard_price - (item.cost_price || 0), // profit_value
        item.sort_order
      ])
      insertCount++
    }
    
    console.log(`✅ 已插入 ${insertCount} 个费用项`)
    
    // 提交事务
    await client.query('COMMIT')
    
    // 验证结果
    const afterCount = await client.query(
      'SELECT COUNT(*) as count FROM product_fee_items WHERE product_id = $1',
      [productId]
    )
    console.log(`📊 导入后费用项数量: ${afterCount.rows[0].count}`)
    
    // 显示导入的费用项
    const items = await client.query(`
      SELECT fee_name, fee_name_en, fee_category, unit, standard_price, cost_price, billing_type
      FROM product_fee_items 
      WHERE product_id = $1
      ORDER BY sort_order
    `, [productId])
    
    console.log('\n📋 导入的费用项列表:')
    console.log('─'.repeat(100))
    console.log(
      '费用名称'.padEnd(30) + 
      '类别'.padEnd(12) + 
      '单位'.padEnd(12) + 
      '售价(€)'.padEnd(10) + 
      '成本(€)'.padEnd(10) + 
      '计费方式'
    )
    console.log('─'.repeat(100))
    
    for (const item of items.rows) {
      console.log(
        item.fee_name.padEnd(30) + 
        item.fee_category.padEnd(12) + 
        item.unit.padEnd(12) + 
        String(item.standard_price).padEnd(10) + 
        String(item.cost_price).padEnd(10) + 
        (item.billing_type === 'actual' ? '实报实销' : '固定价格')
      )
    }
    
    console.log('─'.repeat(100))
    console.log('\n🎉 欧洲自税清关服务报价导入完成！')
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ 导入失败:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// 执行导入
importClearancePrices().catch(err => {
  console.error('❌ 脚本执行失败:', err)
  process.exit(1)
})

