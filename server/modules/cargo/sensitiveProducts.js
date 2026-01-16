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

/**
 * 获取查验产品详情（包含历史查验记录和统计）
 */
export async function getInspectionProductDetail(id) {
  const db = getDatabase()
  
  try {
    // 获取产品基本信息
    const product = await db.prepare(`
      SELECT * FROM inspection_products WHERE id = ?
    `).get(id)
    
    if (!product) {
      return null
    }
    
    const hsCode = product.hs_code
    const productName = product.product_name
    
    // 从 risk_notes 中提取材质
    const materialMatch = product.risk_notes?.match(/材质[：:]\s*([^，,]+)/)
    const materialValue = materialMatch?.[1]?.trim() || null
    
    // ============ 申报次数统计（从 cargo_items 表） ============
    
    // 1. HS Code 申报次数
    let hsCodeDeclarationCount = 0
    try {
      const hsResult = await db.prepare(`
        SELECT COUNT(*) as count FROM cargo_items 
        WHERE matched_hs_code = ? OR customer_hs_code = ?
      `).get(hsCode, hsCode)
      hsCodeDeclarationCount = parseInt(hsResult?.count) || 0
    } catch (err) {
      console.error('获取HS编码申报次数失败:', err)
    }
    
    // 2. 品名申报次数（该品名+该HS的组合申报次数）
    let productNameDeclarationCount = 0
    try {
      const nameResult = await db.prepare(`
        SELECT COUNT(*) as count FROM cargo_items 
        WHERE (product_name ILIKE ? OR product_name_en ILIKE ?)
          AND (matched_hs_code = ? OR customer_hs_code = ?)
      `).get(`%${productName}%`, `%${productName}%`, hsCode, hsCode)
      productNameDeclarationCount = parseInt(nameResult?.count) || 0
    } catch (err) {
      console.error('获取品名申报次数失败:', err)
    }
    
    // 3. 材质申报次数（该品名+该HS下不同材质的申报次数）
    // 包含详细的申报记录，支持点击穿透查看
    let materialDeclarationCount = 0
    let materialDistribution = []
    try {
      // 先获取每种材质的统计
      const materialStats = await db.prepare(`
        SELECT material, COUNT(*) as count 
        FROM cargo_items 
        WHERE (product_name ILIKE ? OR product_name_en ILIKE ?)
          AND (matched_hs_code = ? OR customer_hs_code = ?)
          AND material IS NOT NULL AND material != ''
        GROUP BY material
        ORDER BY count DESC
      `).all(`%${productName}%`, `%${productName}%`, hsCode, hsCode)
      
      // 获取每种材质的详细申报记录（包含具体案例）
      for (const stat of (materialStats || [])) {
        const detailRecords = await db.prepare(`
          SELECT 
            ci.id, ci.product_name, ci.product_name_en, ci.material,
            ci.matched_hs_code, ci.customer_hs_code, ci.quantity, ci.unit_name,
            ci.total_value, ci.origin_country,
            ci.created_at,
            cim.bill_number, cim.import_file_name as file_name, cim.created_at as import_time
          FROM cargo_items ci
          LEFT JOIN cargo_imports cim ON ci.import_id = cim.id
          WHERE (ci.product_name ILIKE ? OR ci.product_name_en ILIKE ?)
            AND (ci.matched_hs_code = ? OR ci.customer_hs_code = ?)
            AND ci.material = ?
          ORDER BY ci.created_at DESC
          LIMIT 20
        `).all(`%${productName}%`, `%${productName}%`, hsCode, hsCode, stat.material)
        
        materialDistribution.push({
          material: stat.material,
          count: parseInt(stat.count) || 0,
          records: (detailRecords || []).map(r => ({
            id: r.id,
            productName: r.product_name,
            productNameEn: r.product_name_en,
            hsCode: r.matched_hs_code || r.customer_hs_code,
            quantity: r.quantity,
            unit: r.unit_name,
            totalValue: parseFloat(r.total_value) || 0,
            originCountry: r.origin_country,
            billNumber: r.bill_number,
            fileName: r.file_name,
            importTime: r.import_time,
            createdAt: r.created_at
          }))
        })
      }
      
      materialDeclarationCount = materialDistribution.reduce((sum, m) => sum + m.count, 0)
    } catch (err) {
      console.error('获取材质申报次数失败:', err)
    }
    
    // ============ 从 bills 表获取查验记录和统计 ============
    
    // 获取所有包含该产品（品名+HS）的提单查验历史
    let historyRecords = []
    let billInspectionStats = { total: 0, inspected: 0, released: 0, pending: 0 }
    
    // HS code 可能有不同长度（8位、9位、10位），使用前8位进行匹配
    const hsCodePrefix = hsCode.substring(0, 8)
    
    console.log(`[查验产品详情] 产品: ${productName}, HS: ${hsCode}, HS前缀: ${hsCodePrefix}`)
    
    try {
      // 查询包含该品名或HS的提单（通过 inspection_detail JSON字段匹配）
      // 使用 HS code 前8位进行模糊匹配，因为不同系统的 HS code 长度可能不一致
      const billsWithProduct = await db.prepare(`
        SELECT 
          id, bill_number, container_number, inspection, inspection_detail,
          inspection_estimated_time, inspection_start_time, inspection_end_time,
          inspection_result, inspection_release_time, created_at
        FROM bills_of_lading 
        WHERE inspection IS NOT NULL 
          AND inspection != '-'
          AND inspection_detail IS NOT NULL
          AND (
            inspection_detail ILIKE ? 
            OR inspection_detail ILIKE ?
          )
        ORDER BY created_at DESC
        LIMIT 100
      `).all(`%${hsCodePrefix}%`, `%${productName}%`)
      
      console.log(`[查验产品详情] 找到 ${billsWithProduct?.length || 0} 条匹配的提单`)
      
      if (billsWithProduct && billsWithProduct.length > 0) {
        for (const bill of billsWithProduct) {
          try {
            const detail = typeof bill.inspection_detail === 'string' 
              ? JSON.parse(bill.inspection_detail) 
              : bill.inspection_detail
            
            // 解析查验明细，找到匹配的货物
            let items = []
            if (Array.isArray(detail)) {
              items = detail
            } else if (detail?.items) {
              items = detail.items
            }
            
            // 检查是否有匹配该产品的货物项（使用 HS code 前8位匹配）
            const matchedItem = items.find(item => 
              item.hsCode?.startsWith(hsCodePrefix) || 
              hsCode?.startsWith(item.hsCode?.substring(0, 8)) ||
              item.productName?.includes(productName) ||
              productName?.includes(item.productName)
            )
            
            if (matchedItem || items.length > 0) {
              // 为 items 中的货物补充英文品名（如果没有的话）
              const enrichedItems = await Promise.all(items.map(async (item) => {
                // 检测并修正数据颠倒的情况（productName 是数字，hsCode 是文字）
                let correctedItem = { ...item }
                const productNameLooksLikeHsCode = /^\d{8,10}$/.test(item.productName)
                const hsCodeLooksLikeName = item.hsCode && !/^\d+$/.test(item.hsCode)
                
                if (productNameLooksLikeHsCode && hsCodeLooksLikeName) {
                  // 数据颠倒了，交换
                  correctedItem.productName = item.hsCode
                  correctedItem.hsCode = item.productName
                  console.log(`[数据修正] 检测到 hsCode 和 productName 颠倒，已修正: ${correctedItem.productName} (${correctedItem.hsCode})`)
                }
                
                if (correctedItem.productNameEn) return correctedItem // 已有英文品名
                
                let productNameEn = null
                
                // 1. 优先从 cargo_items 表（单证导入数据）获取英文品名
                try {
                  const hsCodePrefix = correctedItem.hsCode?.substring(0, 8) || ''
                  
                  console.log(`[英文品名查询] 查询条件 - 品名: "${correctedItem.productName}", HS: "${correctedItem.hsCode}", HS前缀: "${hsCodePrefix}"`)
                  
                  // 先尝试精确品名 + HS编码匹配
                  let cargoItem = await db.prepare(`
                    SELECT product_name_en, product_name FROM cargo_items 
                    WHERE product_name = ?
                      AND product_name_en IS NOT NULL AND product_name_en != ''
                    ORDER BY created_at DESC
                    LIMIT 1
                  `).get(correctedItem.productName)
                  
                  console.log(`[英文品名查询] 精确品名匹配结果:`, cargoItem)
                  
                  // 如果没找到，尝试模糊品名匹配
                  if (!cargoItem?.product_name_en && correctedItem.productName) {
                    cargoItem = await db.prepare(`
                      SELECT product_name_en, product_name FROM cargo_items 
                      WHERE product_name ILIKE ?
                        AND product_name_en IS NOT NULL AND product_name_en != ''
                      ORDER BY created_at DESC
                      LIMIT 1
                    `).get(`%${correctedItem.productName}%`)
                    console.log(`[英文品名查询] 模糊品名匹配结果:`, cargoItem)
                  }
                  
                  // 如果还没找到，尝试用 HS 编码前8位匹配
                  if (!cargoItem?.product_name_en && hsCodePrefix) {
                    cargoItem = await db.prepare(`
                      SELECT product_name_en, product_name, matched_hs_code FROM cargo_items 
                      WHERE (matched_hs_code LIKE ? OR customer_hs_code LIKE ?)
                        AND product_name_en IS NOT NULL AND product_name_en != ''
                      ORDER BY created_at DESC
                      LIMIT 1
                    `).get(`${hsCodePrefix}%`, `${hsCodePrefix}%`)
                    console.log(`[英文品名查询] HS编码匹配结果:`, cargoItem)
                  }
                  
                  if (cargoItem?.product_name_en) {
                    productNameEn = cargoItem.product_name_en
                    console.log(`[英文品名查询] 成功获取英文品名: "${productNameEn}"`)
                  } else {
                    console.log(`[英文品名查询] 未找到英文品名`)
                  }
                } catch (e) {
                  console.error('查询cargo_items英文品名失败:', e.message)
                }
                
                // 2. 如果 cargo_items 没有，再从 tariff_rates 表获取
                if (!productNameEn) {
                  try {
                    const tariff = await db.prepare(`
                      SELECT goods_description FROM tariff_rates 
                      WHERE hs_code = ? OR hs_code_10 = ?
                      LIMIT 1
                    `).get(correctedItem.hsCode, correctedItem.hsCode)
                    
                    if (tariff?.goods_description) {
                      productNameEn = tariff.goods_description
                    }
                  } catch (e) {
                    // 忽略查询错误
                  }
                }
                
                return productNameEn ? { ...correctedItem, productNameEn } : correctedItem
              }))
              
              historyRecords.push({
                id: bill.id,
                billNo: bill.bill_number,
                containerNo: bill.container_number,
                inspectionStatus: bill.inspection,
                inspectionResult: detail?.result || bill.inspection_result,
                inspectionDate: detail?.schedule?.date || bill.inspection_start_time,
                inspectionTime: detail?.schedule?.time,
                customsOffice: detail?.schedule?.location,
                penaltyAmount: parseFloat(bill.inspection_penalty) || 0,
                releaseType: detail?.release?.releaseType,
                // 优先使用 JSON 中的放行日期，其次使用数据库字段
                releaseDate: detail?.release?.releaseDate || bill.inspection_release_time,
                notes: detail?.result?.notes || detail?.release?.notes,
                items: enrichedItems,
                createdAt: bill.created_at
              })
            }
          } catch (parseErr) {
            // JSON 解析失败，跳过
          }
        }
      }
      
      // 统计查验状态分布（使用 HS code 前8位匹配）
      // 查验状态包括：待查验、查验中、已查验、查验放行、已放行
      const statsResult = await db.prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN inspection IN ('待查验', '查验中', '已查验', '查验放行', '已放行') THEN 1 END) as inspected,
          COUNT(CASE WHEN inspection IN ('查验放行', '已放行') THEN 1 END) as released,
          COUNT(CASE WHEN inspection IN ('待查验', '查验中') THEN 1 END) as pending
        FROM bills_of_lading 
        WHERE inspection IS NOT NULL 
          AND inspection != '-'
          AND inspection_detail IS NOT NULL
          AND (
            inspection_detail ILIKE ? 
            OR inspection_detail ILIKE ?
          )
      `).get(`%${hsCodePrefix}%`, `%${productName}%`)
      
      if (statsResult) {
        billInspectionStats = {
          total: parseInt(statsResult.total) || 0,
          inspected: parseInt(statsResult.inspected) || 0,
          released: parseInt(statsResult.released) || 0,
          pending: parseInt(statsResult.pending) || 0
        }
      }
    } catch (billErr) {
      console.error('获取提单查验记录失败:', billErr)
    }
    
    // 获取关税信息
    let tariffInfo = null
    try {
      tariffInfo = await db.prepare(`
        SELECT 
          goods_description_cn, goods_description, 
          duty_rate, vat_rate, anti_dumping_rate,
          countervailing_rate, preferential_rate
        FROM tariff_rates 
        WHERE hs_code = ? OR hs_code_10 = ?
        LIMIT 1
      `).get(hsCode, hsCode)
    } catch (tariffErr) {
      console.error('获取关税信息失败:', tariffErr)
    }
    
    // 优先从 cargo_items 表获取英文品名（比 tariff_rates 的通用描述更具体）
    let productNameEnFromCargo = null
    try {
      // 精确品名匹配
      let cargoItem = await db.prepare(`
        SELECT product_name_en FROM cargo_items 
        WHERE product_name = ?
          AND product_name_en IS NOT NULL AND product_name_en != ''
        ORDER BY created_at DESC
        LIMIT 1
      `).get(productName)
      
      // 模糊品名匹配
      if (!cargoItem?.product_name_en) {
        cargoItem = await db.prepare(`
          SELECT product_name_en FROM cargo_items 
          WHERE product_name ILIKE ?
            AND product_name_en IS NOT NULL AND product_name_en != ''
          ORDER BY created_at DESC
          LIMIT 1
        `).get(`%${productName}%`)
      }
      
      // HS编码匹配
      if (!cargoItem?.product_name_en) {
        cargoItem = await db.prepare(`
          SELECT product_name_en FROM cargo_items 
          WHERE (matched_hs_code = ? OR customer_hs_code = ? OR matched_hs_code LIKE ? OR customer_hs_code LIKE ?)
            AND product_name_en IS NOT NULL AND product_name_en != ''
          ORDER BY created_at DESC
          LIMIT 1
        `).get(hsCode, hsCode, `${hsCodePrefix}%`, `${hsCodePrefix}%`)
      }
      
      if (cargoItem?.product_name_en) {
        productNameEnFromCargo = cargoItem.product_name_en
        console.log(`[英文品名-顶部] 从 cargo_items 获取: "${productNameEnFromCargo}"`)
      }
    } catch (e) {
      console.error('获取cargo_items英文品名失败:', e.message)
    }
    
    // 检查是否为高敏感产品
    let isSensitiveProduct = false
    try {
      const sensitiveResult = await db.prepare(`
        SELECT id, risk_level FROM sensitive_products 
        WHERE hs_code = ? AND is_active = true
        LIMIT 1
      `).get(hsCode)
      isSensitiveProduct = !!sensitiveResult
    } catch (err) {
      console.error('检查敏感产品失败:', err)
    }
    
    // ============ 计算查验率和风险等级 ============
    
    // 申报总次数（使用 HS Code 申报次数作为基准）
    const declarationCount = hsCodeDeclarationCount
    // 查验次数（从 bills 统计）
    const inspectedCount = billInspectionStats.inspected
    // 放行次数
    const passedCount = billInspectionStats.released
    // 待处理次数
    const pendingCount = billInspectionStats.pending
    
    // 查验率 = 查验次数 / 申报次数 × 100%
    const calculatedInspectionRate = declarationCount > 0 
      ? Math.round(inspectedCount * 1000 / declarationCount) / 10  // 保留一位小数
      : null
    
    // 放行率 = 放行次数 / 查验次数 × 100%
    const releaseRate = inspectedCount > 0
      ? Math.round(passedCount * 1000 / inspectedCount) / 10
      : null
    
    // 风险等级计算：
    // 1. 基于查验率：< 5% 低风险, 5-20% 中风险, > 20% 高风险
    // 2. 如果是高敏感产品，至少为中风险
    // 3. 如果全部放行（放行率100%），降低一个等级
    let calculatedRiskLevel = 'low'
    if (calculatedInspectionRate !== null) {
      if (calculatedInspectionRate > 20) {
        calculatedRiskLevel = 'high'
      } else if (calculatedInspectionRate >= 5) {
        calculatedRiskLevel = 'medium'
      } else {
        calculatedRiskLevel = 'low'
      }
    }
    
    // 如果是高敏感产品，至少为中风险
    if (isSensitiveProduct && calculatedRiskLevel === 'low') {
      calculatedRiskLevel = 'medium'
    }
    
    // 如果全部查验都放行了（放行率100%且有查验记录），降低一个风险等级
    if (releaseRate === 100 && inspectedCount > 0) {
      if (calculatedRiskLevel === 'high') {
        calculatedRiskLevel = 'medium'
      } else if (calculatedRiskLevel === 'medium') {
        calculatedRiskLevel = 'low'
      }
    }
    
    return {
      ...product,
      // 材质信息
      material: materialValue,
      // 基本信息
      tariffInfo: tariffInfo ? {
        goodsDescriptionCn: tariffInfo.goods_description_cn,
        // 英文品名优先使用 cargo_items 的具体品名，其次使用 tariff_rates 的通用描述
        goodsDescriptionEn: productNameEnFromCargo || tariffInfo.goods_description,
        dutyRate: tariffInfo.duty_rate,
        vatRate: tariffInfo.vat_rate,
        antiDumpingRate: tariffInfo.anti_dumping_rate,
        countervailingRate: tariffInfo.countervailing_rate,
        preferentialRate: tariffInfo.preferential_rate
      } : null,
      // 申报统计
      declarationStats: {
        hsCodeCount: hsCodeDeclarationCount,
        productNameCount: productNameDeclarationCount,
        materialCount: materialDeclarationCount,
        materialTypeCount: materialDistribution.length,  // 材质类型数量
        materialDistribution: materialDistribution.map(m => ({
          material: m.material,
          count: m.count,
          records: m.records || []  // 包含详细申报记录
        })),
        totalDeclarationCount: declarationCount
      },
      // 查验统计数据
      stats: {
        declarationCount,  // 申报次数
        inspectedCount,    // 查验次数
        passedCount,       // 放行次数
        pendingCount,      // 待处理次数
        failedCount: inspectedCount - passedCount - pendingCount,  // 失败次数
        calculatedInspectionRate,  // 查验率
        releaseRate,               // 放行率
        calculatedRiskLevel,       // 计算的风险等级
        isSensitiveProduct         // 是否为高敏感产品
      },
      // 历史查验记录（从 bills 表）
      historyRecords: historyRecords.map(r => ({
        id: r.id,
        billNo: r.billNo,
        containerNo: r.containerNo,
        inspectionStatus: r.inspectionStatus,
        inspectionResult: r.inspectionResult,
        inspectionDate: r.inspectionDate,
        inspectionTime: r.inspectionTime,
        customsOffice: r.customsOffice,
        penaltyAmount: r.penaltyAmount,
        releaseType: r.releaseType,
        releaseDate: r.releaseDate,
        notes: r.notes,
        items: r.items,
        createdAt: r.createdAt
      }))
    }
  } catch (error) {
    console.error('获取查验产品详情函数内部错误:', error)
    throw error
  }
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

