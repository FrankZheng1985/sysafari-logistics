/**
 * 敏感产品和查验产品库管理模块
 * 用于管理高敏感/反倾销产品和海关查验产品
 */

import { getDatabase } from '../../config/database.js'

/**
 * 规范化 HS 编码
 */
function normalizeHsCode(hsCode) {
  if (!hsCode) return hsCode
  return String(hsCode).replace(/[^0-9]/g, '').substring(0, 10)
}

// ======================== 敏感产品库 ========================

/**
 * 获取敏感产品列表
 */
export async function getSensitiveProducts(options = {}) {
  const db = getDatabase()
  const { 
    page = 1, 
    pageSize = 50, 
    category, 
    productType, 
    riskLevel, 
    search,
    isActive = true 
  } = options

  let whereConditions = []
  const params = []

  if (isActive !== null && isActive !== undefined) {
    whereConditions.push('is_active = ?')
    params.push(isActive)
  }
  
  if (category) {
    whereConditions.push('category = ?')
    params.push(category)
  }
  
  if (productType) {
    whereConditions.push('product_type = ?')
    params.push(productType)
  }
  
  if (riskLevel) {
    whereConditions.push('risk_level = ?')
    params.push(riskLevel)
  }
  
  if (search) {
    whereConditions.push('(product_name ILIKE ? OR hs_code ILIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
  
  // 获取总数
  const countSql = `SELECT COUNT(*) as total FROM sensitive_products ${whereClause}`
  const countResult = await db.prepare(countSql).get(...params)
  const total = countResult?.total || 0
  
  // 获取列表
  const offset = (page - 1) * pageSize
  const listSql = `
    SELECT * FROM sensitive_products 
    ${whereClause}
    ORDER BY category, product_name
    LIMIT ? OFFSET ?
  `
  const list = await db.prepare(listSql).all(...params, pageSize, offset)

  return {
    list,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

/**
 * 获取敏感产品分类列表
 */
export async function getSensitiveProductCategories() {
  const db = getDatabase()
  const result = await db.prepare(`
    SELECT category, COUNT(*) as count
    FROM sensitive_products
    WHERE category IS NOT NULL AND is_active = true
    GROUP BY category
    ORDER BY count DESC
  `).all()
  
  return result || []
}

/**
 * 根据HS编码检查是否为敏感产品
 * 支持：精确匹配、用户HS以数据库编码为前缀（章节级匹配）
 */
export async function checkSensitiveProduct(hsCode) {
  if (!hsCode) return { isSensitive: false, products: [] }
  
  const db = getDatabase()
  const normalizedCode = normalizeHsCode(hsCode)
  
  // 查询匹配的敏感产品：
  // 1. 精确匹配：hs_code = normalizedCode
  // 2. 章节匹配：用户的HS编码以数据库中的短编码开头（如用户5701230000匹配数据库57）
  // 3. 前缀匹配：数据库的HS编码以用户输入开头
  const products = await db.prepare(`
    SELECT * FROM sensitive_products 
    WHERE is_active = true 
    AND (
      hs_code = ? 
      OR ? LIKE hs_code || '%'
      OR hs_code LIKE ? || '%'
    )
  `).all(normalizedCode, normalizedCode, normalizedCode)
  
  return {
    isSensitive: products && products.length > 0,
    products: products || [],
    riskLevel: products?.[0]?.risk_level || 'low',
    isAntiDumping: products?.some(p => p.product_type === 'anti_dumping') || false
  }
}

/**
 * 根据品名模糊匹配敏感产品
 */
export async function matchSensitiveByName(productName) {
  if (!productName) return { isSensitive: false, products: [] }
  
  const db = getDatabase()
  const products = await db.prepare(`
    SELECT * FROM sensitive_products 
    WHERE is_active = true 
    AND (product_name ILIKE ? OR ? ILIKE '%' || product_name || '%')
    ORDER BY 
      CASE WHEN product_name = ? THEN 0
           WHEN product_name ILIKE ? THEN 1
           ELSE 2
      END
  `).all(`%${productName}%`, productName, productName, `${productName}%`)
  
  return {
    isSensitive: products && products.length > 0,
    products: products || [],
    riskLevel: products?.[0]?.risk_level || 'low'
  }
}

/**
 * 创建敏感产品
 */
export async function createSensitiveProduct(data) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const {
    category,
    productName,
    hsCode,
    dutyRate,
    dutyRateMin,
    dutyRateMax,
    productType = 'sensitive',
    riskLevel = 'high',
    riskNotes
  } = data
  
  const result = await db.prepare(`
    INSERT INTO sensitive_products (
      category, product_name, hs_code, duty_rate, 
      duty_rate_min, duty_rate_max, product_type, risk_level,
      risk_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    category,
    productName,
    hsCode,
    dutyRate,
    dutyRateMin,
    dutyRateMax,
    productType,
    riskLevel,
    riskNotes,
    now,
    now
  )
  
  return result?.id
}

/**
 * 更新敏感产品
 */
export async function updateSensitiveProduct(id, data) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const fields = []
  const values = []
  
  if (data.category !== undefined) {
    fields.push('category = ?')
    values.push(data.category)
  }
  if (data.productName !== undefined) {
    fields.push('product_name = ?')
    values.push(data.productName)
  }
  if (data.hsCode !== undefined) {
    fields.push('hs_code = ?')
    values.push(data.hsCode)
  }
  if (data.dutyRate !== undefined) {
    fields.push('duty_rate = ?')
    values.push(data.dutyRate)
  }
  if (data.dutyRateMin !== undefined) {
    fields.push('duty_rate_min = ?')
    values.push(data.dutyRateMin)
  }
  if (data.dutyRateMax !== undefined) {
    fields.push('duty_rate_max = ?')
    values.push(data.dutyRateMax)
  }
  if (data.productType !== undefined) {
    fields.push('product_type = ?')
    values.push(data.productType)
  }
  if (data.riskLevel !== undefined) {
    fields.push('risk_level = ?')
    values.push(data.riskLevel)
  }
  if (data.riskNotes !== undefined) {
    fields.push('risk_notes = ?')
    values.push(data.riskNotes)
  }
  if (data.isActive !== undefined) {
    fields.push('is_active = ?')
    values.push(data.isActive)
  }
  
  fields.push('updated_at = ?')
  values.push(now)
  values.push(id)
  
  await db.prepare(`
    UPDATE sensitive_products SET ${fields.join(', ')} WHERE id = ?
  `).run(...values)
  
  return true
}

/**
 * 删除敏感产品
 */
export async function deleteSensitiveProduct(id) {
  const db = getDatabase()
  await db.prepare('DELETE FROM sensitive_products WHERE id = ?').run(id)
  return true
}

// ======================== 查验产品库 ========================

/**
 * 获取查验产品列表
 */
export async function getInspectionProducts(options = {}) {
  const db = getDatabase()
  const { 
    page = 1, 
    pageSize = 50, 
    riskLevel, 
    search,
    isActive = true 
  } = options

  let whereConditions = []
  const params = []

  if (isActive !== null && isActive !== undefined) {
    whereConditions.push('is_active = ?')
    params.push(isActive)
  }
  
  if (riskLevel) {
    whereConditions.push('risk_level = ?')
    params.push(riskLevel)
  }
  
  if (search) {
    whereConditions.push('(product_name ILIKE ? OR hs_code ILIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
  
  // 获取总数
  const countSql = `SELECT COUNT(*) as total FROM inspection_products ${whereClause}`
  const countResult = await db.prepare(countSql).get(...params)
  const total = countResult?.total || 0
  
  // 获取列表
  const offset = (page - 1) * pageSize
  const listSql = `
    SELECT * FROM inspection_products 
    ${whereClause}
    ORDER BY risk_level DESC, product_name
    LIMIT ? OFFSET ?
  `
  const list = await db.prepare(listSql).all(...params, pageSize, offset)

  return {
    list,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

/**
 * 根据HS编码检查是否为查验产品
 * 支持：精确匹配、章节级匹配（用户HS以数据库编码为前缀）
 */
export async function checkInspectionProduct(hsCode) {
  if (!hsCode) return { isInspectionRisk: false, products: [] }
  
  const db = getDatabase()
  const normalizedCode = normalizeHsCode(hsCode)
  
  const products = await db.prepare(`
    SELECT * FROM inspection_products 
    WHERE is_active = true 
    AND (
      hs_code = ? 
      OR ? LIKE hs_code || '%'
      OR hs_code LIKE ? || '%'
    )
  `).all(normalizedCode, normalizedCode, normalizedCode)
  
  return {
    isInspectionRisk: products && products.length > 0,
    products: products || [],
    riskLevel: products?.[0]?.risk_level || 'low',
    inspectionRate: products?.[0]?.inspection_rate || null
  }
}

/**
 * 根据品名模糊匹配查验产品
 */
export async function matchInspectionByName(productName) {
  if (!productName) return { isInspectionRisk: false, products: [] }
  
  const db = getDatabase()
  const products = await db.prepare(`
    SELECT * FROM inspection_products 
    WHERE is_active = true 
    AND (product_name ILIKE ? OR ? ILIKE '%' || product_name || '%')
    ORDER BY risk_level DESC
  `).all(`%${productName}%`, productName)
  
  return {
    isInspectionRisk: products && products.length > 0,
    products: products || [],
    riskLevel: products?.[0]?.risk_level || 'low'
  }
}

/**
 * 创建查验产品
 */
export async function createInspectionProduct(data) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const {
    productName,
    hsCode,
    dutyRate = 0,
    inspectionRate,
    riskLevel = 'medium',
    riskNotes
  } = data
  
  const result = await db.prepare(`
    INSERT INTO inspection_products (
      product_name, hs_code, duty_rate, inspection_rate,
      risk_level, risk_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    productName,
    normalizeHsCode(hsCode),
    dutyRate,
    inspectionRate,
    riskLevel,
    riskNotes,
    now,
    now
  )
  
  return result?.id
}

/**
 * 更新查验产品
 */
export async function updateInspectionProduct(id, data) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const fields = []
  const values = []
  
  if (data.productName !== undefined) {
    fields.push('product_name = ?')
    values.push(data.productName)
  }
  if (data.hsCode !== undefined) {
    fields.push('hs_code = ?')
    values.push(normalizeHsCode(data.hsCode))
  }
  if (data.dutyRate !== undefined) {
    fields.push('duty_rate = ?')
    values.push(data.dutyRate)
  }
  if (data.inspectionRate !== undefined) {
    fields.push('inspection_rate = ?')
    values.push(data.inspectionRate)
  }
  if (data.riskLevel !== undefined) {
    fields.push('risk_level = ?')
    values.push(data.riskLevel)
  }
  if (data.riskNotes !== undefined) {
    fields.push('risk_notes = ?')
    values.push(data.riskNotes)
  }
  if (data.isActive !== undefined) {
    fields.push('is_active = ?')
    values.push(data.isActive)
  }
  
  fields.push('updated_at = ?')
  values.push(now)
  values.push(id)
  
  await db.prepare(`
    UPDATE inspection_products SET ${fields.join(', ')} WHERE id = ?
  `).run(...values)
  
  return true
}

/**
 * 删除查验产品
 */
export async function deleteInspectionProduct(id) {
  const db = getDatabase()
  await db.prepare('DELETE FROM inspection_products WHERE id = ?').run(id)
  return true
}

// ======================== 综合风险检测 ========================

/**
 * 综合检测产品风险（同时检查敏感产品库和查验产品库）
 */
export async function checkProductRisk(hsCode, productName) {
  const sensitiveResult = await checkSensitiveProduct(hsCode)
  const inspectionResult = await checkInspectionProduct(hsCode)
  
  // 如果HS编码没有匹配到，尝试用品名匹配
  let nameMatch = { isSensitive: false, isInspectionRisk: false }
  if (!sensitiveResult.isSensitive && productName) {
    nameMatch = await matchSensitiveByName(productName)
  }
  if (!inspectionResult.isInspectionRisk && productName) {
    const inspNameMatch = await matchInspectionByName(productName)
    nameMatch.isInspectionRisk = inspNameMatch.isInspectionRisk
    nameMatch.inspectionProducts = inspNameMatch.products
  }
  
  const isSensitive = sensitiveResult.isSensitive || nameMatch.isSensitive
  const isAntiDumping = sensitiveResult.isAntiDumping
  const isInspectionRisk = inspectionResult.isInspectionRisk || nameMatch.isInspectionRisk
  
  // 确定综合风险等级
  let overallRiskLevel = 'low'
  if (isAntiDumping) {
    overallRiskLevel = 'high'
  } else if (isSensitive && sensitiveResult.riskLevel === 'high') {
    overallRiskLevel = 'high'
  } else if (isInspectionRisk && inspectionResult.riskLevel === 'high') {
    overallRiskLevel = 'high'
  } else if (isSensitive || isInspectionRisk) {
    overallRiskLevel = 'medium'
  }
  
  // 生成风险警告
  const warnings = []
  if (isAntiDumping) {
    warnings.push('⚠️ 该产品可能涉及反倾销措施')
  }
  if (isSensitive && !isAntiDumping) {
    warnings.push('⚠️ 该产品为高敏感产品，请注意HS归类')
  }
  if (isInspectionRisk) {
    warnings.push('⚠️ 该产品历史查验率较高')
  }
  
  return {
    isSensitive,
    isAntiDumping,
    isInspectionRisk,
    overallRiskLevel,
    sensitiveProducts: sensitiveResult.products,
    inspectionProducts: inspectionResult.products,
    warnings,
    needsAttention: isSensitive || isInspectionRisk
  }
}

/**
 * 批量检测导入批次的产品风险
 */
export async function batchCheckImportRisk(importId) {
  const db = getDatabase()
  
  // 获取货物明细
  const items = await db.prepare(`
    SELECT id, matched_hs_code, product_name
    FROM cargo_items 
    WHERE import_id = ? AND matched_hs_code IS NOT NULL
  `).all(importId)
  
  const riskItems = []
  let sensitiveCount = 0
  let antiDumpingCount = 0
  let inspectionRiskCount = 0
  
  for (const item of (items || [])) {
    const riskCheck = await checkProductRisk(item.matched_hs_code, item.product_name)
    
    if (riskCheck.needsAttention) {
      riskItems.push({
        itemId: item.id,
        hsCode: item.matched_hs_code,
        productName: item.product_name,
        ...riskCheck
      })
      
      if (riskCheck.isSensitive) sensitiveCount++
      if (riskCheck.isAntiDumping) antiDumpingCount++
      if (riskCheck.isInspectionRisk) inspectionRiskCount++
    }
  }
  
  return {
    importId,
    totalItems: (items || []).length,
    sensitiveCount,
    antiDumpingCount,
    inspectionRiskCount,
    riskItems,
    hasRisk: riskItems.length > 0
  }
}

/**
 * 获取产品库统计信息
 */
export async function getProductLibraryStats() {
  const db = getDatabase()
  
  // 敏感产品统计
  const sensitiveStats = await db.prepare(`
    SELECT 
      product_type,
      risk_level,
      COUNT(*) as count
    FROM sensitive_products
    WHERE is_active = true
    GROUP BY product_type, risk_level
  `).all()
  
  // 查验产品统计
  const inspectionStats = await db.prepare(`
    SELECT 
      risk_level,
      COUNT(*) as count
    FROM inspection_products
    WHERE is_active = true
    GROUP BY risk_level
  `).all()
  
  // 总数
  const sensitiveTotal = await db.prepare(`
    SELECT COUNT(*) as total FROM sensitive_products WHERE is_active = true
  `).get()
  
  const inspectionTotal = await db.prepare(`
    SELECT COUNT(*) as total FROM inspection_products WHERE is_active = true
  `).get()
  
  return {
    sensitive: {
      total: parseInt(sensitiveTotal?.total, 10) || 0,
      byType: sensitiveStats || [],
      antiDumpingCount: sensitiveStats?.filter(s => s.product_type === 'anti_dumping').reduce((sum, s) => sum + parseInt(s.count, 10), 0) || 0
    },
    inspection: {
      total: parseInt(inspectionTotal?.total, 10) || 0,
      byRiskLevel: inspectionStats || []
    }
  }
}

