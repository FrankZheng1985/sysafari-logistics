/**
 * 插入货物导入测试数据
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

async function seedCargoImports() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  })

  const client = await pool.connect()
  
  try {
    console.log('🌱 开始插入货物导入测试数据...')

    const now = new Date().toISOString()

    // 插入3个导入批次
    const imports = [
      {
        import_no: 'IMP2024120001',
        customer_id: 'CUST001',
        customer_name: '深圳贸易有限公司',
        container_no: 'MSKU1234567',
        bill_number: 'BL2024120001',
        origin_country_code: 'CN',
        total_items: 5,
        matched_items: 5,
        pending_items: 0,
        total_value: 16050,
        total_duty: 1449.4,
        total_vat: 3324.89,
        total_other_tax: 0,
        status: 'completed',
        import_file_name: 'test-cargo-data.csv',
        created_by: 'admin'
      },
      {
        import_no: 'IMP2024120002',
        customer_id: 'CUST002',
        customer_name: '广州电子科技',
        container_no: 'MSKU7654321',
        bill_number: 'BL2024120002',
        origin_country_code: 'CN',
        total_items: 5,
        matched_items: 4,
        pending_items: 1,
        total_value: 31400,
        total_duty: 814.5,
        total_vat: 6120.76,
        total_other_tax: 0,
        status: 'reviewing',
        import_file_name: 'electronic-goods.csv',
        created_by: 'admin'
      },
      {
        import_no: 'IMP2024120003',
        customer_id: 'CUST003',
        customer_name: '杭州家居用品',
        container_no: 'MSKU9876543',
        bill_number: 'BL2024120003',
        origin_country_code: 'CN',
        total_items: 5,
        matched_items: 3,
        pending_items: 2,
        total_value: 16000,
        total_duty: 1156,
        total_vat: 3259.64,
        total_other_tax: 0,
        status: 'matching',
        import_file_name: 'household-items.csv',
        created_by: 'admin'
      }
    ]

    // 货物明细数据
    const cargoItems = {
      'IMP2024120001': [
        { item_no: 1, product_name: '男式棉质T恤', product_name_en: "Men's Cotton T-shirt", customer_hs_code: '61091000', matched_hs_code: '61091000', match_confidence: 100, match_source: 'exact', quantity: 500, unit_code: 'PCS', unit_name: '件', unit_price: 5.50, total_value: 2750, gross_weight: 150, net_weight: 120, origin_country: 'CN', material: '100%棉', duty_rate: 12, vat_rate: 19, duty_amount: 330, vat_amount: 585.2, match_status: 'approved' },
        { item_no: 2, product_name: '女式丝质连衣裙', product_name_en: "Women's Silk Dress", customer_hs_code: '62044300', matched_hs_code: '62044300', match_confidence: 100, match_source: 'exact', quantity: 200, unit_code: 'PCS', unit_name: '件', unit_price: 25.00, total_value: 5000, gross_weight: 80, net_weight: 65, origin_country: 'CN', material: '100%丝绸', duty_rate: 12, vat_rate: 19, duty_amount: 600, vat_amount: 1064, match_status: 'approved' },
        { item_no: 3, product_name: '儿童运动鞋', product_name_en: "Children's Sports Shoes", customer_hs_code: '64041900', matched_hs_code: '64041900', match_confidence: 100, match_source: 'exact', quantity: 300, unit_code: 'PR', unit_name: '双', unit_price: 12.00, total_value: 3600, gross_weight: 200, net_weight: 180, origin_country: 'VN', material: '合成革+橡胶底', duty_rate: 8, vat_rate: 19, duty_amount: 288, vat_amount: 739.12, match_status: 'approved' },
        { item_no: 4, product_name: '不锈钢厨具套装', product_name_en: 'Stainless Steel Cookware Set', customer_hs_code: '73239300', matched_hs_code: '73239300', match_confidence: 100, match_source: 'exact', quantity: 100, unit_code: 'SET', unit_name: '套', unit_price: 35.00, total_value: 3500, gross_weight: 500, net_weight: 450, origin_country: 'CN', material: '不锈钢304', duty_rate: 6.5, vat_rate: 19, duty_amount: 227.5, vat_amount: 708.23, match_status: 'approved' },
        { item_no: 5, product_name: 'LED台灯', product_name_en: 'LED Desk Lamp', customer_hs_code: '94052100', matched_hs_code: '94052100', match_confidence: 95, match_source: 'prefix', quantity: 150, unit_code: 'PCS', unit_name: '件', unit_price: 8.00, total_value: 1200, gross_weight: 90, net_weight: 75, origin_country: 'CN', material: '塑料+金属', duty_rate: 4.7, vat_rate: 19, duty_amount: 56.4, vat_amount: 238.72, match_status: 'approved' }
      ],
      'IMP2024120002': [
        { item_no: 1, product_name: '蓝牙耳机', product_name_en: 'Bluetooth Earphones', customer_hs_code: '85183000', matched_hs_code: '85183000', match_confidence: 100, match_source: 'exact', quantity: 800, unit_code: 'PCS', unit_name: '件', unit_price: 15.00, total_value: 12000, gross_weight: 40, net_weight: 35, origin_country: 'CN', material: '塑料+电子元件', duty_rate: 0, vat_rate: 19, duty_amount: 0, vat_amount: 2280, match_status: 'approved' },
        { item_no: 2, product_name: '智能手表', product_name_en: 'Smart Watch', customer_hs_code: '91021200', matched_hs_code: '91021200', match_confidence: 100, match_source: 'exact', quantity: 200, unit_code: 'PCS', unit_name: '件', unit_price: 45.00, total_value: 9000, gross_weight: 25, net_weight: 20, origin_country: 'CN', material: '金属+塑料+电子', duty_rate: 4.5, vat_rate: 19, duty_amount: 405, vat_amount: 1786.95, match_status: 'approved' },
        { item_no: 3, product_name: 'USB数据线', product_name_en: 'USB Cable', customer_hs_code: '85444290', matched_hs_code: '85444290', match_confidence: 100, match_source: 'exact', quantity: 2000, unit_code: 'PCS', unit_name: '件', unit_price: 1.50, total_value: 3000, gross_weight: 100, net_weight: 90, origin_country: 'CN', material: '铜+PVC', duty_rate: 3.3, vat_rate: 19, duty_amount: 99, vat_amount: 588.81, match_status: 'approved' },
        { item_no: 4, product_name: '手机壳', product_name_en: 'Phone Case', customer_hs_code: '39269099', matched_hs_code: '39269099', match_confidence: 85, match_source: 'fuzzy', quantity: 1000, unit_code: 'PCS', unit_name: '件', unit_price: 2.00, total_value: 2000, gross_weight: 50, net_weight: 45, origin_country: 'CN', material: '硅胶', duty_rate: 6.5, vat_rate: 19, duty_amount: 130, vat_amount: 404.7, match_status: 'approved' },
        { item_no: 5, product_name: '充电宝', product_name_en: 'Power Bank', customer_hs_code: '85076000', matched_hs_code: null, match_confidence: 0, match_source: null, quantity: 300, unit_code: 'PCS', unit_name: '件', unit_price: 18.00, total_value: 5400, gross_weight: 150, net_weight: 130, origin_country: 'CN', material: '锂电池+塑料', duty_rate: 0, vat_rate: 19, duty_amount: 0, vat_amount: 0, match_status: 'review' }
      ],
      'IMP2024120003': [
        { item_no: 1, product_name: '陶瓷餐具', product_name_en: 'Ceramic Tableware', customer_hs_code: '69111000', matched_hs_code: '69111000', match_confidence: 100, match_source: 'exact', quantity: 400, unit_code: 'SET', unit_name: '套', unit_price: 20.00, total_value: 8000, gross_weight: 800, net_weight: 700, origin_country: 'CN', material: '陶瓷', duty_rate: 12, vat_rate: 19, duty_amount: 960, vat_amount: 1702.4, match_status: 'approved' },
        { item_no: 2, product_name: '玻璃花瓶', product_name_en: 'Glass Vase', customer_hs_code: '70139900', matched_hs_code: '70139900', match_confidence: 100, match_source: 'exact', quantity: 200, unit_code: 'PCS', unit_name: '件', unit_price: 8.00, total_value: 1600, gross_weight: 300, net_weight: 250, origin_country: 'CN', material: '玻璃', duty_rate: 5, vat_rate: 19, duty_amount: 80, vat_amount: 319.2, match_status: 'approved' },
        { item_no: 3, product_name: '木制相框', product_name_en: 'Wooden Photo Frame', customer_hs_code: '44140090', matched_hs_code: '44140090', match_confidence: 90, match_source: 'prefix', quantity: 500, unit_code: 'PCS', unit_name: '件', unit_price: 3.00, total_value: 1500, gross_weight: 150, net_weight: 130, origin_country: 'CN', material: '松木', duty_rate: 3, vat_rate: 19, duty_amount: 45, vat_amount: 293.55, match_status: 'approved' },
        { item_no: 4, product_name: '塑料收纳盒', product_name_en: 'Plastic Storage Box', customer_hs_code: '39241000', matched_hs_code: null, match_confidence: 0, match_source: null, quantity: 600, unit_code: 'PCS', unit_name: '件', unit_price: 4.00, total_value: 2400, gross_weight: 180, net_weight: 160, origin_country: 'CN', material: 'PP塑料', duty_rate: 0, vat_rate: 19, duty_amount: 0, vat_amount: 0, match_status: 'pending' },
        { item_no: 5, product_name: '棉质毛巾', product_name_en: 'Cotton Towel', customer_hs_code: '63026000', matched_hs_code: null, match_confidence: 0, match_source: null, quantity: 1000, unit_code: 'PCS', unit_name: '件', unit_price: 2.50, total_value: 2500, gross_weight: 200, net_weight: 180, origin_country: 'PK', material: '100%棉', duty_rate: 0, vat_rate: 19, duty_amount: 0, vat_amount: 0, match_status: 'pending' }
      ]
    }

    // 插入导入批次
    for (const imp of imports) {
      const result = await client.query(`
        INSERT INTO cargo_imports (
          import_no, customer_id, customer_name, container_no, bill_number,
          origin_country_code, total_items, matched_items, pending_items,
          total_value, total_duty, total_vat, total_other_tax,
          status, import_file_name, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17)
        ON CONFLICT (import_no) DO UPDATE SET
          status = EXCLUDED.status,
          matched_items = EXCLUDED.matched_items,
          pending_items = EXCLUDED.pending_items,
          total_duty = EXCLUDED.total_duty,
          total_vat = EXCLUDED.total_vat,
          updated_at = EXCLUDED.updated_at
        RETURNING id
      `, [
        imp.import_no, imp.customer_id, imp.customer_name, imp.container_no, imp.bill_number,
        imp.origin_country_code, imp.total_items, imp.matched_items, imp.pending_items,
        imp.total_value, imp.total_duty, imp.total_vat, imp.total_other_tax,
        imp.status, imp.import_file_name, imp.created_by, now
      ])
      
      const importId = result.rows[0].id
      console.log(`  ✅ 导入批次: ${imp.import_no} (ID: ${importId}) - ${imp.customer_name}`)

      // 插入货物明细
      const items = cargoItems[imp.import_no]
      if (items) {
        for (const item of items) {
          await client.query(`
            INSERT INTO cargo_items (
              import_id, item_no, product_name, product_name_en, customer_hs_code,
              matched_hs_code, match_confidence, match_source, quantity, unit_code, unit_name,
              unit_price, total_value, gross_weight, net_weight, origin_country, material,
              duty_rate, vat_rate, duty_amount, vat_amount, other_tax_amount, total_tax,
              match_status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
            ON CONFLICT DO NOTHING
          `, [
            importId, item.item_no, item.product_name, item.product_name_en, item.customer_hs_code,
            item.matched_hs_code, item.match_confidence, item.match_source, item.quantity, item.unit_code, item.unit_name,
            item.unit_price, item.total_value, item.gross_weight, item.net_weight, item.origin_country, item.material,
            item.duty_rate, item.vat_rate, item.duty_amount, item.vat_amount, 0, (item.duty_amount + item.vat_amount),
            item.match_status, now
          ])
        }
        console.log(`     📦 已插入 ${items.length} 条货物明细`)
      }
    }

    console.log('\n✅ 货物导入测试数据插入完成！')
    console.log('   - 3 个导入批次')
    console.log('   - 15 条货物明细')
    console.log('\n📋 刷新页面即可看到测试数据')

  } catch (error) {
    console.error('❌ 插入测试数据失败:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// 运行
seedCargoImports()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
