/**
 * 插入报价管理测试数据脚本
 * 包含产品定价和供应商报价数据
 * 
 * 使用方式：
 * DATABASE_URL=<演示环境数据库URL> node scripts/insert-quote-test-data.js
 */

import pg from 'pg'
import dotenv from 'dotenv'
import { randomUUID } from 'crypto'

const { Pool } = pg
dotenv.config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://fengzheng@localhost/sysafari_dev',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
})

async function insertQuoteTestData() {
  const client = await pool.connect()
  
  try {
    console.log('🚀 开始插入报价管理测试数据...\n')
    console.log('📌 目标数据库:', process.env.DATABASE_URL ? '远程数据库' : '本地数据库')
    console.log('')
    
    // ========== 1. 插入产品数据 ==========
    console.log('📦 插入产品数据...')
    const products = [
      { id: 'prod-001', code: 'FCL-SEA', name: '整柜海运服务', nameEn: 'Full Container Load Sea Freight', category: 'sea_freight', desc: '提供整柜海运服务，包含订舱、港口操作、海运运输等', sort: 1 },
      { id: 'prod-002', code: 'LCL-SEA', name: '拼箱海运服务', nameEn: 'Less Container Load Sea Freight', category: 'sea_freight', desc: '提供拼箱海运服务，适合小批量货物', sort: 2 },
      { id: 'prod-003', code: 'CUSTOMS', name: '清关服务', nameEn: 'Customs Clearance Service', category: 'customs', desc: '提供进出口清关服务，包含报关、查验、放行等', sort: 3 },
      { id: 'prod-004', code: 'WAREHOUSE', name: '仓储服务', nameEn: 'Warehousing Service', category: 'warehouse', desc: '提供仓储、分拣、包装等增值服务', sort: 4 },
      { id: 'prod-005', code: 'TRUCKING', name: '陆运配送服务', nameEn: 'Trucking & Delivery Service', category: 'trucking', desc: '提供欧洲境内陆运配送服务', sort: 5 },
      { id: 'prod-006', code: 'AIR-FREIGHT', name: '空运服务', nameEn: 'Air Freight Service', category: 'air_freight', desc: '提供空运服务，适合紧急或高价值货物', sort: 6 },
      { id: 'prod-007', code: 'RAIL-FREIGHT', name: '铁路运输服务', nameEn: 'Rail Freight Service', category: 'rail_freight', desc: '提供中欧铁路运输服务', sort: 7 }
    ]
    
    for (const p of products) {
      await client.query(`
        INSERT INTO products (id, product_code, product_name, product_name_en, category, description, is_active, sort_order, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, true, $7, 'admin', NOW())
        ON CONFLICT (id) DO UPDATE SET product_name = EXCLUDED.product_name, updated_at = NOW()
      `, [p.id, p.code, p.name, p.nameEn, p.category, p.desc, p.sort])
    }
    console.log(`  ✅ 已插入 ${products.length} 个产品\n`)

    // ========== 2. 插入产品费用项 ==========
    console.log('💰 插入产品费用项...')
    const productFeeItems = [
      // 整柜海运服务费用项
      { productId: 'prod-001', name: '海运费', nameEn: 'Ocean Freight', category: 'freight', unit: '柜', price: 1200, minPrice: 800, maxPrice: 2000, required: true, desc: '基本海运费用', sort: 1 },
      { productId: 'prod-001', name: '订舱费', nameEn: 'Booking Fee', category: 'handling', unit: '票', price: 50, minPrice: 50, maxPrice: 50, required: true, desc: '订舱服务费', sort: 2 },
      { productId: 'prod-001', name: '文件费', nameEn: 'Documentation Fee', category: 'handling', unit: '票', price: 35, minPrice: 35, maxPrice: 50, required: true, desc: '提单、舱单等文件费用', sort: 3 },
      { productId: 'prod-001', name: '港口操作费', nameEn: 'Terminal Handling Charge', category: 'terminal', unit: '柜', price: 280, minPrice: 250, maxPrice: 350, required: true, desc: '起运港装卸费', sort: 4 },
      { productId: 'prod-001', name: '封条费', nameEn: 'Seal Fee', category: 'handling', unit: '个', price: 15, minPrice: 15, maxPrice: 20, required: false, desc: '集装箱封条', sort: 5 },
      { productId: 'prod-001', name: '燃油附加费', nameEn: 'Bunker Adjustment Factor', category: 'surcharge', unit: '柜', price: 150, minPrice: null, maxPrice: null, required: false, desc: '根据油价浮动，实报实销', sort: 6 },
      
      // 拼箱海运服务费用项
      { productId: 'prod-002', name: '海运费', nameEn: 'Ocean Freight', category: 'freight', unit: 'CBM', price: 65, minPrice: 50, maxPrice: 100, required: true, desc: '按立方计费', sort: 1 },
      { productId: 'prod-002', name: '拼箱服务费', nameEn: 'Consolidation Fee', category: 'handling', unit: 'CBM', price: 25, minPrice: 20, maxPrice: 35, required: true, desc: '货物拼装服务', sort: 2 },
      { productId: 'prod-002', name: '文件费', nameEn: 'Documentation Fee', category: 'handling', unit: '票', price: 35, minPrice: 35, maxPrice: 50, required: true, desc: '提单文件费', sort: 3 },
      { productId: 'prod-002', name: '最低收费', nameEn: 'Minimum Charge', category: 'freight', unit: '票', price: 150, minPrice: 150, maxPrice: 150, required: false, desc: '不足最低立方按此收费', sort: 4 },
      
      // 清关服务费用项
      { productId: 'prod-003', name: '报关费', nameEn: 'Customs Declaration Fee', category: 'customs', unit: '票', price: 85, minPrice: 65, maxPrice: 120, required: true, desc: '标准报关服务', sort: 1 },
      { productId: 'prod-003', name: '查验费', nameEn: 'Inspection Fee', category: 'customs', unit: '票', price: 180, minPrice: 150, maxPrice: 300, required: false, desc: '海关查验配合费', sort: 2 },
      { productId: 'prod-003', name: '商检费', nameEn: 'CIQ Fee', category: 'customs', unit: '票', price: 120, minPrice: 100, maxPrice: 180, required: false, desc: '商品检验检疫', sort: 3 },
      { productId: 'prod-003', name: '关税代垫', nameEn: 'Duty Advance', category: 'duty', unit: '票', price: 0, minPrice: null, maxPrice: null, required: false, desc: '实报实销', sort: 4 },
      
      // 仓储服务费用项
      { productId: 'prod-004', name: '仓储费', nameEn: 'Storage Fee', category: 'warehouse', unit: 'CBM/天', price: 1.5, minPrice: 1, maxPrice: 2.5, required: true, desc: '按立方按天计费', sort: 1 },
      { productId: 'prod-004', name: '入库费', nameEn: 'Receiving Fee', category: 'warehouse', unit: 'CBM', price: 8, minPrice: 6, maxPrice: 12, required: true, desc: '货物入库操作', sort: 2 },
      { productId: 'prod-004', name: '出库费', nameEn: 'Dispatching Fee', category: 'warehouse', unit: 'CBM', price: 8, minPrice: 6, maxPrice: 12, required: true, desc: '货物出库操作', sort: 3 },
      { productId: 'prod-004', name: '分拣费', nameEn: 'Sorting Fee', category: 'warehouse', unit: '件', price: 0.5, minPrice: 0.3, maxPrice: 1, required: false, desc: '按件分拣', sort: 4 },
      
      // 陆运配送服务费用项
      { productId: 'prod-005', name: '陆运费', nameEn: 'Trucking Fee', category: 'freight', unit: 'KM', price: 2.5, minPrice: 2, maxPrice: 4, required: true, desc: '按公里计费', sort: 1 },
      { productId: 'prod-005', name: '起步价', nameEn: 'Minimum Charge', category: 'freight', unit: '票', price: 180, minPrice: 150, maxPrice: 250, required: true, desc: '最低运费', sort: 2 },
      { productId: 'prod-005', name: '尾板车附加费', nameEn: 'Tail Lift Surcharge', category: 'surcharge', unit: '票', price: 80, minPrice: 60, maxPrice: 120, required: false, desc: '需要尾板卸货', sort: 3 },
      
      // 空运服务费用项
      { productId: 'prod-006', name: '空运费', nameEn: 'Air Freight', category: 'freight', unit: 'KG', price: 4.5, minPrice: 3, maxPrice: 8, required: true, desc: '按公斤计费', sort: 1 },
      { productId: 'prod-006', name: '燃油附加费', nameEn: 'Fuel Surcharge', category: 'surcharge', unit: 'KG', price: 0.8, minPrice: null, maxPrice: null, required: true, desc: '按重量收取', sort: 2 },
      { productId: 'prod-006', name: '机场操作费', nameEn: 'Airport Handling Fee', category: 'terminal', unit: '票', price: 120, minPrice: 100, maxPrice: 180, required: true, desc: '机场地面操作', sort: 3 },
      
      // 铁路运输服务费用项
      { productId: 'prod-007', name: '铁路运费', nameEn: 'Rail Freight', category: 'freight', unit: '柜', price: 3500, minPrice: 3000, maxPrice: 5000, required: true, desc: '中欧铁路运费', sort: 1 },
      { productId: 'prod-007', name: '装车费', nameEn: 'Loading Fee', category: 'handling', unit: '柜', price: 200, minPrice: 150, maxPrice: 280, required: true, desc: '铁路站装车', sort: 2 },
      { productId: 'prod-007', name: '口岸换装费', nameEn: 'Transshipment Fee', category: 'handling', unit: '柜', price: 350, minPrice: 300, maxPrice: 450, required: true, desc: '边境口岸换装', sort: 3 }
    ]
    
    for (const f of productFeeItems) {
      const id = randomUUID()
      await client.query(`
        INSERT INTO product_fee_items (id, product_id, fee_name, fee_name_en, fee_category, unit, standard_price, min_price, max_price, currency, is_required, description, sort_order, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'EUR', $10, $11, $12, NOW())
        ON CONFLICT DO NOTHING
      `, [id, f.productId, f.name, f.nameEn, f.category, f.unit, f.price, f.minPrice, f.maxPrice, f.required, f.desc, f.sort])
    }
    console.log(`  ✅ 已插入 ${productFeeItems.length} 条产品费用项\n`)

    // ========== 3. 插入供应商报价 ==========
    console.log('🏭 插入供应商报价...')
    const supplierPrices = [
      // COSCO 海运报价
      { supplierId: 'sup-001', supplierName: 'COSCO Shipping Lines Co., Ltd', name: '整柜海运费 20GP', nameEn: 'Ocean Freight 20GP', category: 'freight', unit: '柜', price: 850, routeFrom: '上海', routeTo: '汉堡' },
      { supplierId: 'sup-001', supplierName: 'COSCO Shipping Lines Co., Ltd', name: '整柜海运费 40GP', nameEn: 'Ocean Freight 40GP', category: 'freight', unit: '柜', price: 1100, routeFrom: '上海', routeTo: '汉堡' },
      { supplierId: 'sup-001', supplierName: 'COSCO Shipping Lines Co., Ltd', name: '整柜海运费 40HQ', nameEn: 'Ocean Freight 40HQ', category: 'freight', unit: '柜', price: 1150, routeFrom: '上海', routeTo: '汉堡' },
      { supplierId: 'sup-001', supplierName: 'COSCO Shipping Lines Co., Ltd', name: 'THC起运港', nameEn: 'Origin THC', category: 'terminal', unit: '柜', price: 180, routeFrom: '', routeTo: '' },
      { supplierId: 'sup-001', supplierName: 'COSCO Shipping Lines Co., Ltd', name: '文件费', nameEn: 'Documentation Fee', category: 'handling', unit: '票', price: 30, routeFrom: '', routeTo: '' },
      { supplierId: 'sup-001', supplierName: 'COSCO Shipping Lines Co., Ltd', name: '燃油附加费', nameEn: 'BAF', category: 'surcharge', unit: '柜', price: 120, routeFrom: '', routeTo: '' },
      
      // Maersk 海运报价
      { supplierId: 'sup-002', supplierName: 'Maersk Line', name: '整柜海运费 20GP', nameEn: 'Ocean Freight 20GP', category: 'freight', unit: '柜', price: 920, routeFrom: '宁波', routeTo: '鹿特丹' },
      { supplierId: 'sup-002', supplierName: 'Maersk Line', name: '整柜海运费 40GP', nameEn: 'Ocean Freight 40GP', category: 'freight', unit: '柜', price: 1200, routeFrom: '宁波', routeTo: '鹿特丹' },
      { supplierId: 'sup-002', supplierName: 'Maersk Line', name: '整柜海运费 40HQ', nameEn: 'Ocean Freight 40HQ', category: 'freight', unit: '柜', price: 1250, routeFrom: '宁波', routeTo: '鹿特丹' },
      { supplierId: 'sup-002', supplierName: 'Maersk Line', name: 'THC起运港', nameEn: 'Origin THC', category: 'terminal', unit: '柜', price: 195, routeFrom: '', routeTo: '' },
      { supplierId: 'sup-002', supplierName: 'Maersk Line', name: '低硫燃油附加费', nameEn: 'LSS', category: 'surcharge', unit: '柜', price: 85, routeFrom: '', routeTo: '' },
      
      // Hamburg Logistics 仓储报价
      { supplierId: 'sup-003', supplierName: 'Hamburg Logistics GmbH', name: '仓储费', nameEn: 'Storage Fee', category: 'warehouse', unit: 'CBM/天', price: 1.2, routeFrom: '', routeTo: '' },
      { supplierId: 'sup-003', supplierName: 'Hamburg Logistics GmbH', name: '入库费', nameEn: 'Receiving Fee', category: 'warehouse', unit: 'CBM', price: 6.5, routeFrom: '', routeTo: '' },
      { supplierId: 'sup-003', supplierName: 'Hamburg Logistics GmbH', name: '出库费', nameEn: 'Dispatching Fee', category: 'warehouse', unit: 'CBM', price: 6.5, routeFrom: '', routeTo: '' },
      { supplierId: 'sup-003', supplierName: 'Hamburg Logistics GmbH', name: '拆柜费 20GP', nameEn: 'Devanning 20GP', category: 'warehouse', unit: '柜', price: 180, routeFrom: '', routeTo: '' },
      { supplierId: 'sup-003', supplierName: 'Hamburg Logistics GmbH', name: '拆柜费 40GP/HQ', nameEn: 'Devanning 40GP/HQ', category: 'warehouse', unit: '柜', price: 280, routeFrom: '', routeTo: '' },
      
      // Euro Customs 清关报价
      { supplierId: 'sup-004', supplierName: 'Euro Customs Services', name: '报关费', nameEn: 'Customs Declaration Fee', category: 'customs', unit: '票', price: 65, routeFrom: '', routeTo: '' },
      { supplierId: 'sup-004', supplierName: 'Euro Customs Services', name: '查验配合费', nameEn: 'Inspection Assistance Fee', category: 'customs', unit: '票', price: 150, routeFrom: '', routeTo: '' },
      { supplierId: 'sup-004', supplierName: 'Euro Customs Services', name: '加急报关费', nameEn: 'Express Clearance Fee', category: 'customs', unit: '票', price: 120, routeFrom: '', routeTo: '' },
      
      // Rotterdam Trucking 陆运报价
      { supplierId: 'sup-005', supplierName: 'Rotterdam Trucking BV', name: '陆运费 - 荷兰境内', nameEn: 'Trucking - NL', category: 'freight', unit: 'KM', price: 2.2, routeFrom: '', routeTo: '' },
      { supplierId: 'sup-005', supplierName: 'Rotterdam Trucking BV', name: '陆运费 - 德国', nameEn: 'Trucking - DE', category: 'freight', unit: 'KM', price: 2.4, routeFrom: '', routeTo: '' },
      { supplierId: 'sup-005', supplierName: 'Rotterdam Trucking BV', name: '起步价', nameEn: 'Minimum Charge', category: 'freight', unit: '票', price: 150, routeFrom: '', routeTo: '' },
      { supplierId: 'sup-005', supplierName: 'Rotterdam Trucking BV', name: '尾板车', nameEn: 'Tail Lift', category: 'surcharge', unit: '票', price: 65, routeFrom: '', routeTo: '' },
      
      // Antwerp Terminal 码头报价
      { supplierId: 'sup-006', supplierName: 'Antwerp Terminal Operations', name: 'THC 20GP', nameEn: 'THC 20GP', category: 'terminal', unit: '柜', price: 165, routeFrom: '', routeTo: '' },
      { supplierId: 'sup-006', supplierName: 'Antwerp Terminal Operations', name: 'THC 40GP/HQ', nameEn: 'THC 40GP/HQ', category: 'terminal', unit: '柜', price: 245, routeFrom: '', routeTo: '' },
      { supplierId: 'sup-006', supplierName: 'Antwerp Terminal Operations', name: '堆存费 (免费期后)', nameEn: 'Demurrage', category: 'terminal', unit: '柜/天', price: 45, routeFrom: '', routeTo: '' }
    ]
    
    for (const s of supplierPrices) {
      const id = randomUUID()
      await client.query(`
        INSERT INTO supplier_price_items (id, supplier_id, supplier_name, fee_name, fee_name_en, fee_category, unit, price, currency, effective_date, expiry_date, route_from, route_to, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'EUR', '2025-01-01', '2025-12-31', $9, $10, NOW())
        ON CONFLICT DO NOTHING
      `, [id, s.supplierId, s.supplierName, s.name, s.nameEn, s.category, s.unit, s.price, s.routeFrom, s.routeTo])
    }
    console.log(`  ✅ 已插入 ${supplierPrices.length} 条供应商报价\n`)

    console.log('🎉 报价管理测试数据插入完成！\n')
    
    // 显示统计
    console.log('📈 数据统计:')
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM products) as products,
        (SELECT COUNT(*) FROM product_fee_items) as product_fee_items,
        (SELECT COUNT(*) FROM supplier_price_items) as supplier_price_items
    `)
    console.log(`  - 产品: ${stats.rows[0].products} 个`)
    console.log(`  - 产品费用项: ${stats.rows[0].product_fee_items} 条`)
    console.log(`  - 供应商报价: ${stats.rows[0].supplier_price_items} 条`)
    
  } catch (error) {
    console.error('❌ 插入数据失败:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

insertQuoteTestData().catch(console.error)
