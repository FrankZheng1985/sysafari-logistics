/**
 * 产品管理模块 - 数据模型
 * 用于管理公司销售产品及其费用项配置
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== 产品管理 ====================

/**
 * 获取产品列表
 */
export async function getProducts(params = {}) {
  const db = getDatabase()
  const { category, isActive, search, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM products WHERE 1=1'
  const queryParams = []
  
  if (category) {
    query += ' AND category = ?'
    queryParams.push(category)
  }
  
  if (isActive !== undefined) {
    query += ' AND is_active = ?'
    queryParams.push(isActive ? 1 : 0)
  }
  
  if (search) {
    query += ' AND (product_name LIKE ? OR product_code LIKE ? OR product_name_en LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY sort_order, created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: (list || []).map(convertProductToCamelCase),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 获取单个产品（包含费用项）
 */
export async function getProductById(id) {
  const db = getDatabase()
  const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  
  if (!product) return null
  
  // 获取费用项
  const feeItems = await db.prepare(
    'SELECT * FROM product_fee_items WHERE product_id = ? ORDER BY sort_order, id'
  ).all(id)
  
  return {
    ...convertProductToCamelCase(product),
    feeItems: (feeItems || []).map(convertFeeItemToCamelCase)
  }
}

/**
 * 创建产品
 */
export async function createProduct(data) {
  const db = getDatabase()
  const id = generateId()
  
  // 生成产品编码
  const productCode = await generateProductCode()
  
  await db.prepare(`
    INSERT INTO products (
      id, product_code, product_name, product_name_en, category,
      description, is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    id,
    productCode,
    data.productName,
    data.productNameEn || '',
    data.category || '',
    data.description || '',
    data.isActive !== false ? 1 : 0,
    data.sortOrder || 0,
    data.createdBy || null
  )
  
  return { id, productCode }
}

/**
 * 更新产品
 */
export async function updateProduct(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    productName: 'product_name',
    productNameEn: 'product_name_en',
    category: 'category',
    description: 'description',
    isActive: 'is_active',
    sortOrder: 'sort_order'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      if (jsField === 'isActive') {
        values.push(data[jsField] ? 1 : 0)
      } else {
        values.push(data[jsField])
      }
    }
  })
  
  if (fields.length === 0) return false
  
  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)
  
  const result = await db.prepare(
    `UPDATE products SET ${fields.join(', ')} WHERE id = ?`
  ).run(...values)
  
  return result.changes > 0
}

/**
 * 删除产品
 */
export async function deleteProduct(id) {
  const db = getDatabase()
  // 费用项会通过外键级联删除
  const result = await db.prepare('DELETE FROM products WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 产品费用项管理 ====================

/**
 * 获取产品费用项列表
 */
export async function getProductFeeItems(productId) {
  const db = getDatabase()
  const items = await db.prepare(
    'SELECT * FROM product_fee_items WHERE product_id = ? ORDER BY sort_order, id'
  ).all(productId)
  
  return (items || []).map(convertFeeItemToCamelCase)
}

/**
 * 添加产品费用项
 */
export async function addProductFeeItem(productId, data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    INSERT INTO product_fee_items (
      product_id, fee_name, fee_name_en, fee_category, unit,
      standard_price, min_price, max_price, currency, is_required,
      description, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id
  `).get(
    productId,
    data.feeName,
    data.feeNameEn || '',
    data.feeCategory || 'other',
    data.unit || '',
    data.standardPrice || 0,
    data.minPrice || null,
    data.maxPrice || null,
    data.currency || 'EUR',
    data.isRequired ? 1 : 0,
    data.description || '',
    data.sortOrder || 0
  )
  
  return { id: result?.id }
}

/**
 * 更新产品费用项
 */
export async function updateProductFeeItem(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    feeName: 'fee_name',
    feeNameEn: 'fee_name_en',
    feeCategory: 'fee_category',
    unit: 'unit',
    standardPrice: 'standard_price',
    minPrice: 'min_price',
    maxPrice: 'max_price',
    currency: 'currency',
    isRequired: 'is_required',
    description: 'description',
    sortOrder: 'sort_order'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      if (jsField === 'isRequired') {
        values.push(data[jsField] ? 1 : 0)
      } else {
        values.push(data[jsField])
      }
    }
  })
  
  if (fields.length === 0) return false
  
  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)
  
  const result = await db.prepare(
    `UPDATE product_fee_items SET ${fields.join(', ')} WHERE id = ?`
  ).run(...values)
  
  return result.changes > 0
}

/**
 * 删除产品费用项
 */
export async function deleteProductFeeItem(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM product_fee_items WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 批量设置产品费用项
 */
export async function setProductFeeItems(productId, items) {
  const db = getDatabase()
  
  // 删除现有费用项
  await db.prepare('DELETE FROM product_fee_items WHERE product_id = ?').run(productId)
  
  // 插入新费用项
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    await db.prepare(`
      INSERT INTO product_fee_items (
        product_id, fee_name, fee_name_en, fee_category, unit,
        standard_price, min_price, max_price, currency, is_required,
        description, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      productId,
      item.feeName,
      item.feeNameEn || '',
      item.feeCategory || 'other',
      item.unit || '',
      item.standardPrice || 0,
      item.minPrice || null,
      item.maxPrice || null,
      item.currency || 'EUR',
      item.isRequired ? 1 : 0,
      item.description || '',
      i
    )
  }
  
  return true
}

// ==================== 工具函数 ====================

/**
 * 生成产品编码
 */
async function generateProductCode() {
  const db = getDatabase()
  const prefix = 'PRD'
  
  const result = await db.prepare(`
    SELECT product_code FROM products 
    WHERE product_code LIKE ? 
    ORDER BY product_code DESC LIMIT 1
  `).get(`${prefix}%`)
  
  let seq = 1
  if (result) {
    const lastSeq = parseInt(result.product_code.replace(prefix, ''))
    seq = lastSeq + 1
  }
  
  return `${prefix}${String(seq).padStart(4, '0')}`
}

/**
 * 转换产品数据为驼峰命名
 */
function convertProductToCamelCase(row) {
  return {
    id: row.id,
    productCode: row.product_code,
    productName: row.product_name,
    productNameEn: row.product_name_en,
    category: row.category,
    description: row.description,
    isActive: row.is_active === 1,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * 转换费用项数据为驼峰命名
 */
function convertFeeItemToCamelCase(row) {
  return {
    id: row.id,
    productId: row.product_id,
    feeName: row.fee_name,
    feeNameEn: row.fee_name_en,
    feeCategory: row.fee_category,
    unit: row.unit,
    standardPrice: parseFloat(row.standard_price) || 0,
    minPrice: row.min_price ? parseFloat(row.min_price) : null,
    maxPrice: row.max_price ? parseFloat(row.max_price) : null,
    currency: row.currency,
    isRequired: row.is_required === 1,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * 插入演示测试数据
 */
export async function seedDemoData() {
  const db = getDatabase()
  
  // 产品数据
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
    await db.prepare(`
      INSERT INTO products (id, product_code, product_name, product_name_en, category, description, is_active, sort_order, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'admin', CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET product_name = EXCLUDED.product_name, updated_at = CURRENT_TIMESTAMP
    `).run(p.id, p.code, p.name, p.nameEn, p.category, p.desc, true, p.sort)
  }
  
  // 产品费用项数据
  const productFeeItems = [
    // 整柜海运服务
    { productId: 'prod-001', name: '海运费', nameEn: 'Ocean Freight', category: 'freight', unit: '柜', price: 1200, minPrice: 800, maxPrice: 2000, required: true, desc: '基本海运费用', sort: 1 },
    { productId: 'prod-001', name: '订舱费', nameEn: 'Booking Fee', category: 'handling', unit: '票', price: 50, required: true, desc: '订舱服务费', sort: 2 },
    { productId: 'prod-001', name: '文件费', nameEn: 'Documentation Fee', category: 'handling', unit: '票', price: 35, required: true, desc: '提单文件费', sort: 3 },
    { productId: 'prod-001', name: '港口操作费', nameEn: 'Terminal Handling Charge', category: 'terminal', unit: '柜', price: 280, required: true, desc: '起运港装卸费', sort: 4 },
    { productId: 'prod-001', name: '燃油附加费', nameEn: 'Bunker Adjustment Factor', category: 'surcharge', unit: '柜', price: 150, required: false, desc: '实报实销', sort: 5 },
    // 拼箱海运服务
    { productId: 'prod-002', name: '海运费', nameEn: 'Ocean Freight', category: 'freight', unit: 'CBM', price: 65, minPrice: 50, maxPrice: 100, required: true, desc: '按立方计费', sort: 1 },
    { productId: 'prod-002', name: '拼箱服务费', nameEn: 'Consolidation Fee', category: 'handling', unit: 'CBM', price: 25, required: true, desc: '货物拼装服务', sort: 2 },
    { productId: 'prod-002', name: '文件费', nameEn: 'Documentation Fee', category: 'handling', unit: '票', price: 35, required: true, desc: '提单文件费', sort: 3 },
    // 清关服务
    { productId: 'prod-003', name: '报关费', nameEn: 'Customs Declaration Fee', category: 'customs', unit: '票', price: 85, minPrice: 65, maxPrice: 120, required: true, desc: '标准报关服务', sort: 1 },
    { productId: 'prod-003', name: '查验费', nameEn: 'Inspection Fee', category: 'customs', unit: '票', price: 180, required: false, desc: '海关查验配合费', sort: 2 },
    { productId: 'prod-003', name: '关税代垫', nameEn: 'Duty Advance', category: 'duty', unit: '票', price: 0, required: false, desc: '实报实销', sort: 3 },
    // 仓储服务
    { productId: 'prod-004', name: '仓储费', nameEn: 'Storage Fee', category: 'warehouse', unit: 'CBM/天', price: 1.5, required: true, desc: '按立方按天计费', sort: 1 },
    { productId: 'prod-004', name: '入库费', nameEn: 'Receiving Fee', category: 'warehouse', unit: 'CBM', price: 8, required: true, desc: '货物入库操作', sort: 2 },
    { productId: 'prod-004', name: '出库费', nameEn: 'Dispatching Fee', category: 'warehouse', unit: 'CBM', price: 8, required: true, desc: '货物出库操作', sort: 3 },
    // 陆运配送
    { productId: 'prod-005', name: '陆运费', nameEn: 'Trucking Fee', category: 'freight', unit: 'KM', price: 2.5, required: true, desc: '按公里计费', sort: 1 },
    { productId: 'prod-005', name: '起步价', nameEn: 'Minimum Charge', category: 'freight', unit: '票', price: 180, required: true, desc: '最低运费', sort: 2 },
    // 空运服务
    { productId: 'prod-006', name: '空运费', nameEn: 'Air Freight', category: 'freight', unit: 'KG', price: 4.5, required: true, desc: '按公斤计费', sort: 1 },
    { productId: 'prod-006', name: '燃油附加费', nameEn: 'Fuel Surcharge', category: 'surcharge', unit: 'KG', price: 0.8, required: true, desc: '按重量收取', sort: 2 },
    // 铁路运输
    { productId: 'prod-007', name: '铁路运费', nameEn: 'Rail Freight', category: 'freight', unit: '柜', price: 3500, required: true, desc: '中欧铁路运费', sort: 1 },
    { productId: 'prod-007', name: '装车费', nameEn: 'Loading Fee', category: 'handling', unit: '柜', price: 200, required: true, desc: '铁路站装车', sort: 2 }
  ]
  
  for (const f of productFeeItems) {
    const id = generateId()
    await db.prepare(`
      INSERT INTO product_fee_items (id, product_id, fee_name, fee_name_en, fee_category, unit, standard_price, min_price, max_price, currency, is_required, description, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'EUR', ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT DO NOTHING
    `).run(id, f.productId, f.name, f.nameEn, f.category, f.unit, f.price, f.minPrice || null, f.maxPrice || null, f.required ? 1 : 0, f.desc, f.sort)
  }
  
  // 供应商报价数据
  const supplierPrices = [
    // COSCO
    { supplierId: 'sup-001', supplierName: 'COSCO Shipping Lines Co., Ltd', name: '整柜海运费 20GP', nameEn: 'Ocean Freight 20GP', category: 'freight', unit: '柜', price: 850, routeFrom: '上海', routeTo: '汉堡' },
    { supplierId: 'sup-001', supplierName: 'COSCO Shipping Lines Co., Ltd', name: '整柜海运费 40GP', nameEn: 'Ocean Freight 40GP', category: 'freight', unit: '柜', price: 1100, routeFrom: '上海', routeTo: '汉堡' },
    { supplierId: 'sup-001', supplierName: 'COSCO Shipping Lines Co., Ltd', name: '整柜海运费 40HQ', nameEn: 'Ocean Freight 40HQ', category: 'freight', unit: '柜', price: 1150, routeFrom: '上海', routeTo: '汉堡' },
    { supplierId: 'sup-001', supplierName: 'COSCO Shipping Lines Co., Ltd', name: 'THC起运港', nameEn: 'Origin THC', category: 'terminal', unit: '柜', price: 180, routeFrom: '', routeTo: '' },
    { supplierId: 'sup-001', supplierName: 'COSCO Shipping Lines Co., Ltd', name: '燃油附加费', nameEn: 'BAF', category: 'surcharge', unit: '柜', price: 120, routeFrom: '', routeTo: '' },
    // Maersk
    { supplierId: 'sup-002', supplierName: 'Maersk Line', name: '整柜海运费 20GP', nameEn: 'Ocean Freight 20GP', category: 'freight', unit: '柜', price: 920, routeFrom: '宁波', routeTo: '鹿特丹' },
    { supplierId: 'sup-002', supplierName: 'Maersk Line', name: '整柜海运费 40GP', nameEn: 'Ocean Freight 40GP', category: 'freight', unit: '柜', price: 1200, routeFrom: '宁波', routeTo: '鹿特丹' },
    { supplierId: 'sup-002', supplierName: 'Maersk Line', name: '整柜海运费 40HQ', nameEn: 'Ocean Freight 40HQ', category: 'freight', unit: '柜', price: 1250, routeFrom: '宁波', routeTo: '鹿特丹' },
    { supplierId: 'sup-002', supplierName: 'Maersk Line', name: 'THC起运港', nameEn: 'Origin THC', category: 'terminal', unit: '柜', price: 195, routeFrom: '', routeTo: '' },
    // Hamburg Logistics
    { supplierId: 'sup-003', supplierName: 'Hamburg Logistics GmbH', name: '仓储费', nameEn: 'Storage Fee', category: 'warehouse', unit: 'CBM/天', price: 1.2, routeFrom: '', routeTo: '' },
    { supplierId: 'sup-003', supplierName: 'Hamburg Logistics GmbH', name: '入库费', nameEn: 'Receiving Fee', category: 'warehouse', unit: 'CBM', price: 6.5, routeFrom: '', routeTo: '' },
    { supplierId: 'sup-003', supplierName: 'Hamburg Logistics GmbH', name: '出库费', nameEn: 'Dispatching Fee', category: 'warehouse', unit: 'CBM', price: 6.5, routeFrom: '', routeTo: '' },
    { supplierId: 'sup-003', supplierName: 'Hamburg Logistics GmbH', name: '拆柜费', nameEn: 'Devanning', category: 'warehouse', unit: '柜', price: 220, routeFrom: '', routeTo: '' },
    // Euro Customs
    { supplierId: 'sup-004', supplierName: 'Euro Customs Services', name: '报关费', nameEn: 'Customs Declaration Fee', category: 'customs', unit: '票', price: 65, routeFrom: '', routeTo: '' },
    { supplierId: 'sup-004', supplierName: 'Euro Customs Services', name: '查验配合费', nameEn: 'Inspection Assistance', category: 'customs', unit: '票', price: 150, routeFrom: '', routeTo: '' },
    // Rotterdam Trucking
    { supplierId: 'sup-005', supplierName: 'Rotterdam Trucking BV', name: '陆运费-荷兰境内', nameEn: 'Trucking NL', category: 'freight', unit: 'KM', price: 2.2, routeFrom: '', routeTo: '' },
    { supplierId: 'sup-005', supplierName: 'Rotterdam Trucking BV', name: '陆运费-德国', nameEn: 'Trucking DE', category: 'freight', unit: 'KM', price: 2.4, routeFrom: '', routeTo: '' },
    { supplierId: 'sup-005', supplierName: 'Rotterdam Trucking BV', name: '起步价', nameEn: 'Minimum Charge', category: 'freight', unit: '票', price: 150, routeFrom: '', routeTo: '' }
  ]
  
  for (const s of supplierPrices) {
    const id = generateId()
    await db.prepare(`
      INSERT INTO supplier_price_items (id, supplier_id, supplier_name, fee_name, fee_name_en, fee_category, unit, price, currency, effective_date, expiry_date, route_from, route_to, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'EUR', '2025-01-01', '2025-12-31', ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT DO NOTHING
    `).run(id, s.supplierId, s.supplierName, s.name, s.nameEn, s.category, s.unit, s.price, s.routeFrom, s.routeTo)
  }
  
  // 统计
  const productCount = await db.prepare('SELECT COUNT(*) as count FROM products').get()
  const feeItemCount = await db.prepare('SELECT COUNT(*) as count FROM product_fee_items').get()
  const priceCount = await db.prepare('SELECT COUNT(*) as count FROM supplier_price_items').get()
  
  return {
    products: productCount?.count || 0,
    productFeeItems: feeItemCount?.count || 0,
    supplierPriceItems: priceCount?.count || 0
  }
}

export default {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductFeeItems,
  addProductFeeItem,
  updateProductFeeItem,
  deleteProductFeeItem,
  setProductFeeItems,
  seedDemoData
}
