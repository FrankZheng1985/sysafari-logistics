/**
 * 产品管理模块 - 数据模型
 * 用于管理公司销售产品及其费用项配置
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== 工具函数 ====================

/**
 * 销售价格向上取整到50的倍数（仅用于运输费用）
 * 例如: 901-949 → 950, 951-999 → 1000, 932 → 950
 * @param {number} price - 原始价格
 * @param {string} feeCategory - 费用类别
 * @returns {number} 取整后的价格
 */
function roundSalesPriceTo50(price, feeCategory) {
  if (!price || price <= 0) return price
  
  // 只有运输相关费用才取整
  const transportCategories = [
    'transport', 'TRANSPORT', 'trucking', 'TRUCKING', 
    '运输服务', '运输', 'Container Pickup & Delivery'
  ]
  
  // 检查费用类别是否为运输相关（支持模糊匹配）
  const isTransport = transportCategories.some(cat => 
    feeCategory?.toLowerCase?.()?.includes(cat.toLowerCase())
  )
  
  if (!isTransport) {
    return price  // 非运输费用保持原价
  }
  
  return Math.ceil(price / 50) * 50
}

// ==================== 产品管理 ====================

/**
 * 获取产品列表
 */
export async function getProducts(params = {}) {
  const db = getDatabase()
  const { category, isActive, search, page = 1, pageSize = 20 } = params
  
  // 使用子查询获取每个产品的费用项数量
  let query = `
    SELECT p.*, 
           COALESCE((SELECT COUNT(*) FROM product_fee_items WHERE product_id = p.id), 0) as fee_item_count
    FROM products p 
    WHERE 1=1
  `
  const queryParams = []
  
  if (category) {
    query += ' AND p.category = ?'
    queryParams.push(category)
  }
  
  if (isActive !== undefined) {
    query += ' AND p.is_active = ?'
    queryParams.push(isActive ? 1 : 0)
  }
  
  if (search) {
    query += ' AND (p.product_name LIKE ? OR p.product_code LIKE ? OR p.product_name_en LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = 'SELECT COUNT(*) as total FROM products p WHERE 1=1' + 
    (category ? ' AND p.category = ?' : '') +
    (isActive !== undefined ? ' AND p.is_active = ?' : '') +
    (search ? ' AND (p.product_name LIKE ? OR p.product_code LIKE ? OR p.product_name_en LIKE ?)' : '')
  const countParams = queryParams.slice(0, queryParams.length) // 复制参数用于计数查询
  const totalResult = await db.prepare(countQuery).get(...countParams)
  
  // 分页
  query += ' ORDER BY p.sort_order, p.created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: (list || []).map(item => ({
      ...convertProductToCamelCase(item),
      feeItemCount: parseInt(item.fee_item_count) || 0
    })),
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
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
  
  fields.push('updated_at = NOW()')
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
  
  // 如果有利润设置，计算销售价格
  let standardPrice = data.standardPrice || 0
  if (data.costPrice && data.profitValue) {
    if (data.profitType === 'rate') {
      // 利润率: 销售价 = 成本价 * (1 + 利润率/100)
      standardPrice = data.costPrice * (1 + data.profitValue / 100)
    } else {
      // 固定利润: 销售价 = 成本价 + 固定利润额
      standardPrice = data.costPrice + data.profitValue
    }
    // 销售价向上取整到50的倍数（仅运输费用）
    standardPrice = roundSalesPriceTo50(standardPrice, data.feeCategory)
  }
  
  const result = await db.prepare(`
    INSERT INTO product_fee_items (
      product_id, fee_name, fee_name_en, fee_category, unit,
      standard_price, min_price, max_price, currency, is_required,
      description, sort_order,
      supplier_id, supplier_price_id, supplier_name, cost_price, profit_type, profit_value,
      billing_type, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    RETURNING id
  `).get(
    productId,
    data.feeName,
    data.feeNameEn || '',
    data.feeCategory || 'other',
    data.unit || '',
    standardPrice,
    data.minPrice || null,
    data.maxPrice || null,
    data.currency || 'EUR',
    data.isRequired ? 1 : 0,
    data.description || '',
    data.sortOrder || 0,
    data.supplierId || null,
    data.supplierPriceId || null,
    data.supplierName || null,
    data.costPrice || null,
    data.profitType || 'amount',
    data.profitValue || 0,
    data.billingType || 'fixed'  // 计费类型
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
  
  // 如果有利润设置，计算销售价格
  if (data.costPrice !== undefined && data.profitValue !== undefined) {
    if (data.profitType === 'rate') {
      // 利润率: 销售价 = 成本价 * (1 + 利润率/100)
      data.standardPrice = data.costPrice * (1 + data.profitValue / 100)
    } else {
      // 固定利润: 销售价 = 成本价 + 固定利润额
      data.standardPrice = data.costPrice + data.profitValue
    }
    // 销售价向上取整到50的倍数（仅运输费用）
    // 如果没有传入类别，从现有记录获取
    const feeCategory = data.feeCategory || existing?.fee_category
    data.standardPrice = roundSalesPriceTo50(data.standardPrice, feeCategory)
  }
  
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
    sortOrder: 'sort_order',
    // 供应商关联和利润字段
    supplierId: 'supplier_id',
    supplierPriceId: 'supplier_price_id',
    supplierName: 'supplier_name',
    costPrice: 'cost_price',
    profitType: 'profit_type',
    profitValue: 'profit_value',
    billingType: 'billing_type'  // 计费类型
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
  
  fields.push('updated_at = NOW()')
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
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
    // 供应商关联和利润字段
    supplierId: row.supplier_id || null,
    supplierPriceId: row.supplier_price_id || null,
    supplierName: row.supplier_name || null,
    costPrice: row.cost_price ? parseFloat(row.cost_price) : null,
    profitType: row.profit_type || 'amount',
    profitValue: row.profit_value ? parseFloat(row.profit_value) : 0,
    billingType: row.billing_type || 'fixed',  // 计费类型: fixed=固定价格, actual=按实际收费
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ==================== 批量操作 ====================

/**
 * 批量同步成本价（从供应商报价更新）
 * @param {number[]} feeItemIds - 费用项ID数组
 */
export async function batchSyncCostFromSupplier(feeItemIds) {
  const db = getDatabase()
  let updated = 0
  let failed = 0
  const results = []
  
  for (const id of feeItemIds) {
    // 获取费用项及其关联的供应商报价
    const feeItem = await db.prepare(`
      SELECT pfi.*, spi.price as supplier_price, spi.fee_name as supplier_fee_name
      FROM product_fee_items pfi
      LEFT JOIN supplier_price_items spi ON pfi.supplier_price_id = spi.id
      WHERE pfi.id = ?
    `).get(id)
    
    if (!feeItem) {
      failed++
      results.push({ id, success: false, error: '费用项不存在' })
      continue
    }
    
    if (!feeItem.supplier_price_id) {
      failed++
      results.push({ id, success: false, error: '未关联供应商报价' })
      continue
    }
    
    if (feeItem.supplier_price === null) {
      failed++
      results.push({ id, success: false, error: '供应商报价已删除' })
      continue
    }
    
    // 计算新的销售价格
    const costPrice = feeItem.supplier_price
    const profitType = feeItem.profit_type || 'amount'
    const profitValue = parseFloat(feeItem.profit_value) || 0
    
    let standardPrice = costPrice
    if (profitType === 'rate') {
      standardPrice = costPrice * (1 + profitValue / 100)
    } else {
      standardPrice = costPrice + profitValue
    }
    
    // 更新费用项
    await db.prepare(`
      UPDATE product_fee_items 
      SET cost_price = ?, standard_price = ?, updated_at = NOW()
      WHERE id = ?
    `).run(costPrice, standardPrice, id)
    
    updated++
    results.push({ 
      id, 
      success: true, 
      oldCost: feeItem.cost_price,
      newCost: costPrice,
      newPrice: standardPrice
    })
  }
  
  return { updated, failed, results }
}

/**
 * 批量设置利润
 * @param {number[]} feeItemIds - 费用项ID数组
 * @param {string} profitType - 利润类型: 'amount' | 'rate'
 * @param {number} profitValue - 利润值
 */
export async function batchSetProfit(feeItemIds, profitType, profitValue) {
  const db = getDatabase()
  let updated = 0
  const results = []
  
  for (const id of feeItemIds) {
    const feeItem = await db.prepare('SELECT * FROM product_fee_items WHERE id = ?').get(id)
    
    if (!feeItem) {
      results.push({ id, success: false, error: '费用项不存在' })
      continue
    }
    
    const costPrice = parseFloat(feeItem.cost_price) || parseFloat(feeItem.standard_price) || 0
    
    // 计算新的销售价格
    let standardPrice = costPrice
    if (profitType === 'rate') {
      standardPrice = costPrice * (1 + profitValue / 100)
    } else {
      standardPrice = costPrice + profitValue
    }
    // 销售价向上取整到50的倍数（仅运输费用）
    standardPrice = roundSalesPriceTo50(standardPrice, feeItem.fee_category)
    
    // 更新费用项
    await db.prepare(`
      UPDATE product_fee_items 
      SET profit_type = ?, profit_value = ?, standard_price = ?, 
          cost_price = COALESCE(cost_price, standard_price),
          updated_at = NOW()
      WHERE id = ?
    `).run(profitType, profitValue, standardPrice, id)
    
    updated++
    results.push({ 
      id, 
      success: true, 
      costPrice,
      newPrice: standardPrice
    })
  }
  
  return { updated, failed: feeItemIds.length - updated, results }
}

/**
 * 批量从供应商报价导入到产品费用项
 * @param {string} productId - 目标产品ID
 * @param {number[]} supplierPriceIds - 供应商报价ID数组
 * @param {string} profitType - 利润类型
 * @param {number} profitValue - 利润值
 */
export async function batchImportFromSupplier(productId, supplierPriceIds, profitType = 'amount', profitValue = 0) {
  const db = getDatabase()
  let imported = 0
  let skipped = 0
  const results = []
  
  for (const priceId of supplierPriceIds) {
    try {
      // 获取供应商报价
      const supplierPrice = await db.prepare(`
        SELECT * FROM supplier_price_items WHERE id = ?
      `).get(priceId)
      
      if (!supplierPrice) {
        results.push({ priceId, success: false, error: '供应商报价不存在' })
        continue
      }
      
      // 检查是否已经导入过相同的供应商报价到该产品
      const existing = await db.prepare(`
        SELECT id FROM product_fee_items 
        WHERE product_id = ? AND supplier_price_id = ?
      `).get(productId, priceId)
      
      if (existing) {
        skipped++
        results.push({ 
          priceId, 
          success: false, 
          error: '该报价已导入过',
          existingId: existing.id
        })
        continue
      }
      
      // 计算销售价格（成本价保持原价，销售价取整）
      const costPrice = parseFloat(supplierPrice.price) || 0
      let standardPrice = costPrice
      if (profitType === 'rate') {
        standardPrice = costPrice * (1 + profitValue / 100)
      } else {
        standardPrice = costPrice + profitValue
      }
      // 销售价向上取整到50的倍数（仅运输费用）
      standardPrice = roundSalesPriceTo50(standardPrice, supplierPrice.fee_category)
      
      // 创建费用项（不指定 id，让数据库自动生成）
      const result = await db.prepare(`
        INSERT INTO product_fee_items (
          product_id, fee_name, fee_name_en, fee_category, unit,
          standard_price, currency, is_required, description,
          supplier_id, supplier_price_id, supplier_name, cost_price, profit_type, profit_value,
          billing_type, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        RETURNING id
      `).get(
        productId,
        supplierPrice.fee_name,
        supplierPrice.fee_name_en || '',
        supplierPrice.fee_category || 'other',
        supplierPrice.unit || '',
        standardPrice,
        supplierPrice.currency || 'EUR',
        supplierPrice.remark || '',
        supplierPrice.supplier_id,
        priceId,
        supplierPrice.supplier_name || '',
        costPrice,
        profitType,
        profitValue,
        supplierPrice.billing_type || 'fixed'  // 从供应商报价带过来的计费类型
      )
      
      imported++
      results.push({ 
        priceId, 
        success: true, 
        feeItemId: result?.id,
        feeName: supplierPrice.fee_name,
        costPrice,
        standardPrice,
        billingType: supplierPrice.billing_type || 'fixed'
      })
    } catch (error) {
      console.error(`导入报价 ${priceId} 失败:`, error)
      results.push({ 
        priceId, 
        success: false, 
        error: error.message || '导入失败'
      })
    }
  }
  
  return { imported, skipped, failed: supplierPriceIds.length - imported - skipped, results }
}

/**
 * 批量重新计算取整（用于更新旧数据）
 * @param {number[]} feeItemIds - 费用项ID数组
 */
export async function batchRecalculateRounding(feeItemIds) {
  const db = getDatabase()
  let updated = 0
  const results = []
  
  for (const id of feeItemIds) {
    const feeItem = await db.prepare('SELECT * FROM product_fee_items WHERE id = ?').get(id)
    
    if (!feeItem) {
      results.push({ id, success: false, error: '费用项不存在' })
      continue
    }
    
    const costPrice = parseFloat(feeItem.cost_price) || 0
    const profitType = feeItem.profit_type || 'amount'
    const profitValue = parseFloat(feeItem.profit_value) || 0
    
    // 如果没有成本价，使用当前销售价进行取整
    let newPrice
    if (costPrice > 0) {
      // 根据成本价和利润重新计算
      if (profitType === 'rate') {
        newPrice = costPrice * (1 + profitValue / 100)
      } else {
        newPrice = costPrice + profitValue
      }
    } else {
      // 没有成本价，直接对当前销售价取整
      newPrice = parseFloat(feeItem.standard_price) || 0
    }
    
    // 应用取整规则（仅运输费用）
    const oldPrice = parseFloat(feeItem.standard_price) || 0
    newPrice = roundSalesPriceTo50(newPrice, feeItem.fee_category)
    
    // 只有价格变化才更新
    if (Math.abs(newPrice - oldPrice) > 0.01) {
      await db.prepare(`
        UPDATE product_fee_items 
        SET standard_price = ?, updated_at = NOW()
        WHERE id = ?
      `).run(newPrice, id)
      
      updated++
      results.push({ 
        id, 
        success: true, 
        oldPrice,
        newPrice,
        change: newPrice - oldPrice
      })
    } else {
      results.push({ 
        id, 
        success: true, 
        oldPrice,
        newPrice,
        change: 0,
        message: '价格已是取整值'
      })
    }
  }
  
  return { updated, total: feeItemIds.length, results }
}

/**
 * 批量调价
 * @param {number[]} feeItemIds - 费用项ID数组
 * @param {string} adjustType - 调价类型: 'percent' | 'amount'
 * @param {number} adjustValue - 调价值（百分比或金额）
 */
export async function batchAdjustPrice(feeItemIds, adjustType, adjustValue) {
  const db = getDatabase()
  let updated = 0
  const results = []
  
  for (const id of feeItemIds) {
    const feeItem = await db.prepare('SELECT * FROM product_fee_items WHERE id = ?').get(id)
    
    if (!feeItem) {
      results.push({ id, success: false, error: '费用项不存在' })
      continue
    }
    
    const oldPrice = parseFloat(feeItem.standard_price) || 0
    let newPrice = oldPrice
    
    if (adjustType === 'percent') {
      // 按百分比调价
      newPrice = oldPrice * (1 + adjustValue / 100)
    } else {
      // 按固定金额调价
      newPrice = oldPrice + adjustValue
    }
    
    // 确保价格不为负
    newPrice = Math.max(0, newPrice)
    // 销售价向上取整到50的倍数（仅运输费用）
    newPrice = roundSalesPriceTo50(newPrice, feeItem.fee_category)
    
    // 更新费用项
    await db.prepare(`
      UPDATE product_fee_items 
      SET standard_price = ?, updated_at = NOW()
      WHERE id = ?
    `).run(newPrice, id)
    
    updated++
    results.push({ 
      id, 
      success: true, 
      oldPrice,
      newPrice,
      change: newPrice - oldPrice
    })
  }
  
  return { updated, failed: feeItemIds.length - updated, results }
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'admin', NOW())
      ON CONFLICT (id) DO UPDATE SET product_name = EXCLUDED.product_name, updated_at = NOW()
    `).run(p.id, p.code, p.name, p.nameEn, p.category, p.desc, 1, p.sort)
  }

  // 清理测试产品的现有费用项（避免重复）
  await db.prepare("DELETE FROM product_fee_items WHERE product_id LIKE 'prod-%'").run()
  
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
    await db.prepare(`
      INSERT INTO product_fee_items (product_id, fee_name, fee_name_en, fee_category, unit, standard_price, min_price, max_price, currency, is_required, description, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'EUR', ?, ?, ?, NOW())
    `).run(f.productId, f.name, f.nameEn, f.category, f.unit, f.price, f.minPrice || null, f.maxPrice || null, f.required ? 1 : 0, f.desc, f.sort)
  }

  // 清理测试供应商的现有报价（避免重复）
  await db.prepare("DELETE FROM supplier_price_items WHERE supplier_id LIKE 'sup-%'").run()
  
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
    await db.prepare(`
      INSERT INTO supplier_price_items (supplier_id, supplier_name, fee_name, fee_name_en, fee_category, unit, price, currency, effective_date, expiry_date, route_from, route_to, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'EUR', '2025-01-01', '2025-12-31', ?, ?, NOW())
    `).run(s.supplierId, s.supplierName, s.name, s.nameEn, s.category, s.unit, s.price, s.routeFrom, s.routeTo)
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
  // 批量操作
  batchSyncCostFromSupplier,
  batchSetProfit,
  batchImportFromSupplier,
  batchRecalculateRounding,
  batchAdjustPrice,
  seedDemoData
}
