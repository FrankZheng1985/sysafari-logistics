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
  setProductFeeItems
}
