/**
 * 供应商管理模块 - 数据模型
 * 包含：供应商基本信息、联系信息、财务信息等
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== 供应商类型常量 ====================

export const SUPPLIER_TYPES = {
  // === 服务费类别父级（与服务费分类对应） ===
  WAREHOUSE_OPERATION: 'warehouse_operation',   // 仓储操作
  TRANSPORT: 'transport',                       // 运输
  EXPRESS: 'express',                           // 快递
  CUSTOMS_CLEARANCE: 'customs_clearance',       // 清关服务
  DOCUMENT: 'document',                         // 单证费
  DOC_SWAP: 'doc_swap',                         // 换单费
  PORT: 'port',                                 // 港口费
  TAX: 'tax',                                   // 税务
  IMPORT_AGENCY: 'import_agency',               // 进口商代理
  MISC_FEE: 'misc_fee',                         // 费用杂项
  TRUCK_WAITING: 'truck_waiting',               // 卡车等待费
  INSPECTION_FEE: 'inspection_fee',             // 查验费
  CLEARING_DISPATCHING: 'clearing_dispatching', // 清提派业务
  // === 传统供应商类型 ===
  MANUFACTURER: 'manufacturer',    // 生产厂家
  TRADER: 'trader',                // 贸易商
  AGENT: 'agent',                  // 代理商
  DISTRIBUTOR: 'distributor',      // 分销商
  DOC_SWAP_AGENT: 'doc_swap_agent', // 换单代理
  CUSTOMS_AGENT: 'customs_agent',  // 清关代理
  WAREHOUSE: 'warehouse',          // 仓储服务商
  OTHER: 'other'                   // 其他
}

export const SUPPLIER_STATUS = {
  ACTIVE: 'active',                // 启用
  INACTIVE: 'inactive',            // 停用
  PENDING: 'pending',              // 待审核
  BLACKLIST: 'blacklist'           // 黑名单
}

export const SUPPLIER_LEVELS = {
  VIP: 'vip',                      // VIP供应商
  A: 'a',                          // A级供应商
  B: 'b',                          // B级供应商
  C: 'c',                          // C级供应商
  NEW: 'new'                       // 新供应商
}

// ==================== 初始化供应商表 ====================

export async function initSupplierTable() {
  const db = getDatabase()
  
  // 创建供应商表
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      supplier_code TEXT UNIQUE NOT NULL,
      supplier_name TEXT NOT NULL,
      short_name TEXT,
      supplier_type TEXT DEFAULT 'trader',
      
      -- 联系信息
      contact_person TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      contact_mobile TEXT,
      fax TEXT,
      website TEXT,
      
      -- 地址信息
      country TEXT,
      province TEXT,
      city TEXT,
      address TEXT,
      postal_code TEXT,
      
      -- 财务信息
      tax_number TEXT,
      bank_name TEXT,
      bank_account TEXT,
      bank_branch TEXT,
      currency TEXT DEFAULT 'EUR',
      payment_terms TEXT,
      credit_limit NUMERIC(10,2) DEFAULT 0,
      
      -- 合作信息
      status TEXT DEFAULT 'active',
      level TEXT DEFAULT 'new',
      rating INTEGER DEFAULT 0,
      cooperation_date TEXT,
      contract_expire_date TEXT,
      
      -- 备注
      remark TEXT,
      
      -- 时间戳
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      created_by TEXT,
      updated_by TEXT
    )
  `)
  
  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(supplier_code);
    CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(supplier_name);
    CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
    CREATE INDEX IF NOT EXISTS idx_suppliers_type ON suppliers(supplier_type);
    CREATE INDEX IF NOT EXISTS idx_suppliers_level ON suppliers(level);
  `)
  
  console.log('✅ 供应商表初始化完成')
}

// ==================== 供应商CRUD操作 ====================

/**
 * 获取供应商列表
 */
export async function getSupplierList(params = {}) {
  const db = getDatabase()
  const { 
    search, 
    type,
    types,  // 支持多类型过滤（逗号分隔）
    status, 
    level,
    page = 1, 
    pageSize = 20 
  } = params
  
  let query = 'SELECT * FROM suppliers WHERE 1=1'
  const queryParams = []
  
  // 搜索
  if (search) {
    query += ` AND (
      supplier_code LIKE ? OR 
      supplier_name LIKE ? OR 
      short_name LIKE ? OR 
      contact_person LIKE ? OR
      contact_phone LIKE ?
    )`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern)
  }
  
  // 单类型筛选 - 使用 LIKE 支持多类型字段（supplier_type 存储为逗号分隔的字符串）
  if (type) {
    // 支持精确匹配单类型或包含在多类型中
    query += ` AND (supplier_type = ? OR supplier_type LIKE ? OR supplier_type LIKE ? OR supplier_type LIKE ?)`
    queryParams.push(type, `${type},%`, `%,${type},%`, `%,${type}`)
  }
  
  // 多类型筛选（用于运输供应商等场景）- 查找包含任意指定类型的供应商
  if (types && !type) {
    const typeArray = types.split(',').map(t => t.trim()).filter(Boolean)
    if (typeArray.length > 0) {
      const conditions = typeArray.map(() => `(supplier_type = ? OR supplier_type LIKE ? OR supplier_type LIKE ? OR supplier_type LIKE ?)`).join(' OR ')
      query += ` AND (${conditions})`
      typeArray.forEach(t => {
        queryParams.push(t, `${t},%`, `%,${t},%`, `%,${t}`)
      })
    }
  }
  
  // 状态筛选
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  // 级别筛选
  if (level) {
    query += ' AND level = ?'
    queryParams.push(level)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页和排序 - 按供应商编码升序排序（DSA001, DSA002, DSA003...）
  query += ' ORDER BY supplier_code ASC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertToCamelCase),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 根据ID获取供应商
 */
export async function getSupplierById(id) {
  const db = getDatabase()
  const supplier = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id)
  return supplier ? convertToCamelCase(supplier) : null
}

/**
 * 根据编码获取供应商
 */
export async function getSupplierByCode(code) {
  const db = getDatabase()
  const supplier = await db.prepare('SELECT * FROM suppliers WHERE supplier_code = ?').get(code)
  return supplier ? convertToCamelCase(supplier) : null
}

/**
 * 创建供应商
 */
export async function createSupplier(data) {
  const db = getDatabase()
  const id = generateId()
  
  const result = await db.prepare(`
    INSERT INTO suppliers (
      id, supplier_code, supplier_name, short_name, supplier_type,
      contact_person, contact_phone, contact_email, contact_mobile, fax, website,
      country, province, city, address, postal_code,
      tax_number, bank_name, bank_account, bank_branch, currency, payment_terms, credit_limit,
      status, level, rating, cooperation_date, contract_expire_date,
      remark, created_by, updated_by
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?
    )
  `).run(
    id,
    data.supplierCode,
    data.supplierName,
    data.shortName || '',
    data.supplierType || 'trader',
    data.contactPerson || '',
    data.contactPhone || '',
    data.contactEmail || '',
    data.contactMobile || '',
    data.fax || '',
    data.website || '',
    data.country || '',
    data.province || '',
    data.city || '',
    data.address || '',
    data.postalCode || '',
    data.taxNumber || '',
    data.bankName || '',
    data.bankAccount || '',
    data.bankBranch || '',
    data.currency || 'EUR',
    data.paymentTerms || '',
    data.creditLimit || 0,
    data.status || 'active',
    data.level || 'new',
    data.rating || 0,
    data.cooperationDate || null,
    data.contractExpireDate || null,
    data.remark || '',
    data.createdBy || '',
    data.createdBy || ''
  )
  
  return { id, changes: result.changes }
}

/**
 * 更新供应商
 */
export async function updateSupplier(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  // 字段映射：JS字段名 -> DB字段名
  const fieldMap = {
    supplierCode: 'supplier_code',
    supplierName: 'supplier_name',
    shortName: 'short_name',
    supplierType: 'supplier_type',
    contactPerson: 'contact_person',
    contactPhone: 'contact_phone',
    contactEmail: 'contact_email',
    contactMobile: 'contact_mobile',
    fax: 'fax',
    website: 'website',
    country: 'country',
    province: 'province',
    city: 'city',
    address: 'address',
    postalCode: 'postal_code',
    taxNumber: 'tax_number',
    bankName: 'bank_name',
    bankAccount: 'bank_account',
    bankBranch: 'bank_branch',
    currency: 'currency',
    paymentTerms: 'payment_terms',
    creditLimit: 'credit_limit',
    status: 'status',
    level: 'level',
    rating: 'rating',
    cooperationDate: 'cooperation_date',
    contractExpireDate: 'contract_expire_date',
    remark: 'remark',
    updatedBy: 'updated_by'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (fields.length === 0) return false
  
  // 更新时间
  fields.push("updated_at = NOW()")
  values.push(id)
  
  const result = await db.prepare(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除供应商
 */
export async function deleteSupplier(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM suppliers WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 批量删除供应商
 */
export async function batchDeleteSuppliers(ids) {
  const db = getDatabase()
  const placeholders = ids.map(() => '?').join(',')
  const result = await db.prepare(`DELETE FROM suppliers WHERE id IN (${placeholders})`).run(...ids)
  return result.changes
}

/**
 * 更新供应商状态
 */
export async function updateSupplierStatus(id, status, updatedBy) {
  const db = getDatabase()
  const result = await db.prepare(`
    UPDATE suppliers 
    SET status = ?, updated_at = NOW(), updated_by = ?
    WHERE id = ?
  `).run(status, updatedBy || '', id)
  return result.changes > 0
}

/**
 * 检查供应商编码是否存在
 */
export async function checkSupplierCodeExists(code, excludeId = null) {
  const db = getDatabase()
  let query = 'SELECT COUNT(*) as count FROM suppliers WHERE supplier_code = ?'
  const params = [code]
  
  if (excludeId) {
    query += ' AND id != ?'
    params.push(excludeId)
  }
  
  const result = await db.prepare(query).get(...params)
  return result.count > 0
}

/**
 * 获取供应商统计数据
 */
export async function getSupplierStats() {
  const db = getDatabase()
  
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'blacklist' THEN 1 ELSE 0 END) as blacklist,
      SUM(CASE WHEN level = 'vip' THEN 1 ELSE 0 END) as vip,
      SUM(CASE WHEN level = 'a' THEN 1 ELSE 0 END) as levelA,
      SUM(CASE WHEN level = 'b' THEN 1 ELSE 0 END) as levelB,
      SUM(CASE WHEN level = 'c' THEN 1 ELSE 0 END) as levelC,
      SUM(CASE WHEN level = 'new' THEN 1 ELSE 0 END) as newSupplier
    FROM suppliers
  `).get()
  
  return {
    total: stats.total || 0,
    active: stats.active || 0,
    inactive: stats.inactive || 0,
    pending: stats.pending || 0,
    blacklist: stats.blacklist || 0,
    vip: stats.vip || 0,
    levelA: stats.levelA || 0,
    levelB: stats.levelB || 0,
    levelC: stats.levelC || 0,
    newSupplier: stats.newSupplier || 0
  }
}

/**
 * 生成供应商编码
 */
export async function generateSupplierCode() {
  const db = getDatabase()
  const result = await db.prepare(`
    SELECT supplier_code FROM suppliers 
    WHERE supplier_code LIKE 'SUP%' 
    ORDER BY supplier_code DESC 
    LIMIT 1
  `).get()
  
  if (!result) {
    return 'SUP0001'
  }
  
  const lastNum = parseInt(result.supplier_code.replace('SUP', ''), 10)
  const nextNum = lastNum + 1
  return `SUP${String(nextNum).padStart(4, '0')}`
}

/**
 * 获取所有启用的供应商（用于下拉选择）
 */
export async function getActiveSuppliers() {
  const db = getDatabase()
  const list = await db.prepare(`
    SELECT id, supplier_code, supplier_name, short_name 
    FROM suppliers 
    WHERE status = 'active' 
    ORDER BY supplier_name
  `).all()
  
  return list.map(item => ({
    id: item.id,
    supplierCode: item.supplier_code,
    supplierName: item.supplier_name,
    shortName: item.short_name
  }))
}

// ==================== 数据转换函数 ====================

/**
 * 数据库字段转驼峰命名
 */
function convertToCamelCase(row) {
  if (!row) return null
  
  return {
    id: row.id,
    supplierCode: row.supplier_code,
    supplierName: row.supplier_name,
    shortName: row.short_name,
    supplierType: row.supplier_type,
    contactPerson: row.contact_person,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    contactMobile: row.contact_mobile,
    fax: row.fax,
    website: row.website,
    country: row.country,
    province: row.province,
    city: row.city,
    address: row.address,
    postalCode: row.postal_code,
    taxNumber: row.tax_number,
    bankName: row.bank_name,
    bankAccount: row.bank_account,
    bankBranch: row.bank_branch,
    currency: row.currency,
    paymentTerms: row.payment_terms,
    creditLimit: row.credit_limit,
    status: row.status,
    level: row.level,
    rating: row.rating,
    cooperationDate: row.cooperation_date,
    contractExpireDate: row.contract_expire_date,
    remark: row.remark,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by
  }
}

// ==================== 供应商采购价管理 ====================

/**
 * 格式化采购价项数据（从数据库到API）
 */
function formatSupplierPriceItem(row) {
  if (!row) return null
  const price = parseFloat(row.price) || 0
  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    // 兼容两种字段名
    feeName: row.fee_name,
    name: row.fee_name,              // 前端兼容
    feeNameEn: row.fee_name_en,
    nameEn: row.fee_name_en,         // 前端兼容
    category: row.fee_category,
    feeCategory: row.fee_category,   // 前端兼容（FeeModal使用此字段名）
    unit: row.unit,
    price: price,
    unitPrice: price,                // 前端兼容
    currency: row.currency,
    effectiveDate: row.effective_date,
    expiryDate: row.expiry_date,
    validFrom: row.effective_date,   // 前端兼容
    validUntil: row.expiry_date,     // 前端兼容
    isActive: row.status !== 'disabled',  // 前端兼容
    routeFrom: row.route_from,       // 起运地
    country: row.country,            // 国家
    routeTo: row.route_to,           // 目的地邮编
    city: row.city,                  // 城市
    returnPoint: row.return_point,   // 还柜点
    transportMode: row.transport_mode, // 运输方式（空运/海运）
    billingType: row.billing_type || 'fixed', // 计费类型（fixed/actual）
    remark: row.remark,
    notes: row.remark,               // 前端兼容
    importBatchId: row.import_batch_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * 获取供应商的采购价列表
 */
export async function getSupplierPrices(supplierId, options = {}) {
  const db = getDatabase()
  const { category, isActive, search } = options
  
  let sql = `
    SELECT * FROM supplier_price_items 
    WHERE supplier_id = $1
  `
  const params = [supplierId]
  let paramIndex = 2
  
  if (category) {
    sql += ` AND fee_category = $${paramIndex++}`
    params.push(category)
  }
  
  if (search) {
    sql += ` AND (fee_name ILIKE $${paramIndex} OR fee_name_en ILIKE $${paramIndex})`
    params.push(`%${search}%`)
    paramIndex++
  }
  
  sql += ` ORDER BY fee_category, fee_name`
  
  try {
    const result = await db.pool.query(sql, params)
    return result.rows.map(formatSupplierPriceItem)
  } catch (error) {
    console.error('获取采购价列表失败:', error.message)
    return []
  }
}

/**
 * 获取单个采购价
 */
export async function getSupplierPriceById(id) {
  const db = getDatabase()
  try {
    const result = await db.pool.query('SELECT * FROM supplier_price_items WHERE id = $1', [id])
    return result.rows[0] ? formatSupplierPriceItem(result.rows[0]) : null
  } catch (error) {
    console.error('获取采购价失败:', error.message)
    return null
  }
}

/**
 * 创建采购价
 */
export async function createSupplierPrice(data) {
  const db = getDatabase()
  
  try {
    const result = await db.pool.query(`
      INSERT INTO supplier_price_items (
        supplier_id, supplier_name, fee_name, fee_name_en, fee_category, 
        unit, price, currency, effective_date, expiry_date, 
        route_from, route_to, return_point, transport_mode, billing_type, remark
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
    `, [
      data.supplierId,
      data.supplierName || null,
      data.feeName || data.name,
      data.feeNameEn || data.nameEn || null,
      data.category || 'other',
      data.unit || '次',
      data.price || data.unitPrice || 0,
      data.currency || 'EUR',
      data.effectiveDate || data.validFrom || null,
      data.expiryDate || data.validUntil || null,
      data.routeFrom || null,
      data.routeTo || null,
      data.returnPoint || null,
      data.transportMode || null,  // 运输方式
      data.billingType || 'fixed', // 计费类型
      data.remark || data.notes || null
    ])
    
    return { id: result.rows[0].id, ...data }
  } catch (error) {
    console.error('创建采购价失败:', error.message)
    throw error
  }
}

/**
 * 更新采购价
 */
export async function updateSupplierPrice(id, data) {
  const db = getDatabase()
  
  const fields = []
  const values = []
  let paramIndex = 1
  
  // 支持更新供应商名称（用于修复历史数据）
  if (data.supplierName !== undefined) {
    fields.push(`supplier_name = $${paramIndex++}`)
    values.push(data.supplierName)
  }
  
  if (data.category !== undefined) {
    fields.push(`fee_category = $${paramIndex++}`)
    values.push(data.category)
  }
  if (data.feeName !== undefined || data.name !== undefined) {
    fields.push(`fee_name = $${paramIndex++}`)
    values.push(data.feeName || data.name)
  }
  if (data.feeNameEn !== undefined || data.nameEn !== undefined) {
    fields.push(`fee_name_en = $${paramIndex++}`)
    values.push(data.feeNameEn || data.nameEn)
  }
  if (data.unit !== undefined) {
    fields.push(`unit = $${paramIndex++}`)
    values.push(data.unit)
  }
  if (data.price !== undefined || data.unitPrice !== undefined) {
    fields.push(`price = $${paramIndex++}`)
    values.push(data.price || data.unitPrice)
  }
  if (data.currency !== undefined) {
    fields.push(`currency = $${paramIndex++}`)
    values.push(data.currency)
  }
  if (data.effectiveDate !== undefined || data.validFrom !== undefined) {
    fields.push(`effective_date = $${paramIndex++}`)
    values.push(data.effectiveDate || data.validFrom)
  }
  if (data.expiryDate !== undefined || data.validUntil !== undefined) {
    fields.push(`expiry_date = $${paramIndex++}`)
    values.push(data.expiryDate || data.validUntil)
  }
  if (data.remark !== undefined || data.notes !== undefined) {
    fields.push(`remark = $${paramIndex++}`)
    values.push(data.remark || data.notes)
  }
  if (data.routeFrom !== undefined) {
    fields.push(`route_from = $${paramIndex++}`)
    values.push(data.routeFrom)
  }
  if (data.routeTo !== undefined) {
    fields.push(`route_to = $${paramIndex++}`)
    values.push(data.routeTo)
  }
  if (data.returnPoint !== undefined) {
    fields.push(`return_point = $${paramIndex++}`)
    values.push(data.returnPoint)
  }
  if (data.transportMode !== undefined) {
    fields.push(`transport_mode = $${paramIndex++}`)
    values.push(data.transportMode)
  }
  if (data.billingType !== undefined) {
    fields.push(`billing_type = $${paramIndex++}`)
    values.push(data.billingType)
  }
  if (data.isActive !== undefined) {
    fields.push(`status = $${paramIndex++}`)
    values.push(data.isActive ? 'active' : 'disabled')
  }
  
  if (fields.length === 0) {
    return getSupplierPriceById(id)
  }
  
  fields.push(`updated_at = NOW()`)
  values.push(id)
  
  try {
    await db.pool.query(
      `UPDATE supplier_price_items SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    )
    return getSupplierPriceById(id)
  } catch (error) {
    console.error('更新采购价失败:', error.message)
    throw error
  }
}

/**
 * 删除采购价
 */
export async function deleteSupplierPrice(id) {
  const db = getDatabase()
  try {
    await db.pool.query('DELETE FROM supplier_price_items WHERE id = $1', [id])
    return { success: true }
  } catch (error) {
    console.error('删除采购价失败:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * 根据费用名称查找采购价（用于发票生成时获取英文名称）
 */
export async function findSupplierPriceByName(supplierId, feeName) {
  const db = getDatabase()
  try {
    const result = await db.pool.query(`
      SELECT * FROM supplier_price_items 
      WHERE supplier_id = $1 AND fee_name = $2
      ORDER BY created_at DESC
      LIMIT 1
    `, [supplierId, feeName])
    return result.rows[0] ? formatSupplierPriceItem(result.rows[0]) : null
  } catch (error) {
    console.error('查找采购价失败:', error.message)
    return null
  }
}

// ==================== 批量导入相关 ====================

/**
 * 批量创建供应商报价
 */
export async function batchCreateSupplierPrices(supplierId, items, options = {}) {
  const db = getDatabase()
  const { supplierName, importBatchId, fileName } = options
  
  let successCount = 0
  let failCount = 0
  
  for (const item of items) {
    try {
      // id 是自增整数，不需要手动指定
      await db.prepare(`
        INSERT INTO supplier_price_items (
          supplier_id, supplier_name, fee_name, fee_name_en,
          fee_category, unit, price, currency,
          effective_date, expiry_date, route_from, country, route_to, city, return_point,
          transport_mode, remark, import_batch_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `).run(
        supplierId,
        supplierName || '',
        item.feeName || '',
        item.feeNameEn || '',
        item.feeCategory || 'other',
        item.unit || '票',
        item.price || 0,
        item.currency || 'EUR',
        item.effectiveDate || null,
        item.expiryDate || null,
        item.routeFrom || '',      // 起运地
        item.country || '',        // 国家
        item.routeTo || '',        // 目的地邮编
        item.city || '',           // 城市
        item.returnPoint || '',    // 还柜点
        item.transportMode || '',  // 运输方式
        item.remark || '',
        importBatchId
      )
      
      successCount++
    } catch (error) {
      console.error('创建报价失败:', error)
      failCount++
    }
  }
  
  return { successCount, failCount }
}

/**
 * 创建导入记录
 */
export async function createImportRecord(data) {
  const db = getDatabase()
  
  try {
    await db.prepare(`
      INSERT INTO import_records (
        supplier_id, supplier_name, file_name, file_type,
        record_count, status, created_by, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `).run(
      data.supplierId,
      data.supplierName || '',
      data.fileName || '',
      data.fileType || '',
      data.recordCount || 0,
      data.status || 'completed',
      data.createdBy || null
    )
    
    return { success: true }
  } catch (error) {
    console.error('创建导入记录失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 获取导入记录
 */
export async function getImportRecords(supplierId, options = {}) {
  const db = getDatabase()
  const { page = 1, pageSize = 20 } = options
  
  let query = 'SELECT * FROM import_records WHERE 1=1'
  const params = []
  
  if (supplierId) {
    query += ' AND supplier_id = ?'
    params.push(supplierId)
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(pageSize, (page - 1) * pageSize)
  
  const rows = await db.prepare(query).all(...params)
  
  return (rows || []).map(row => ({
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    fileName: row.file_name,
    fileType: row.file_type,
    recordCount: row.record_count,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at
  }))
}

/**
 * 匹配运输报价
 * 根据起点和终点信息匹配供应商的运输报价
 * @param {Object} params - 匹配参数
 * @param {string} params.origin - 起点地址或邮编
 * @param {string} params.destination - 终点地址或邮编
 * @param {string} params.originPostalCode - 起点邮编
 * @param {string} params.destPostalCode - 终点邮编
 */
export async function matchTransportPrices(params = {}) {
  const db = getDatabase()
  const { origin, destination, originPostalCode, destPostalCode } = params
  
  // 提取邮编（如果没有直接提供）
  let originCode = originPostalCode || ''
  let destCode = destPostalCode || ''
  
  // 尝试从地址中提取邮编
  if (!originCode && origin) {
    const match = origin.match(/\b(\d{4,5})\b/)
    if (match) originCode = match[1]
  }
  if (!destCode && destination) {
    const match = destination.match(/\b(\d{4,5})\b/)
    if (match) destCode = match[1]
  }
  
  try {
    // 查询匹配的运输报价
    // 匹配逻辑：
    // 1. 目的地邮编匹配 route_to
    // 2. 费用类别为运输相关（transport, clearing_dispatching, express）
    // 3. 价格有效且状态为启用
    let sql = `
      SELECT 
        spi.*,
        s.supplier_name,
        s.supplier_code,
        s.contact_person,
        s.contact_phone
      FROM supplier_price_items spi
      LEFT JOIN suppliers s ON spi.supplier_id = s.id
      WHERE spi.fee_category IN ('transport', 'clearing_dispatching', 'express', 'freight')
        AND (spi.status IS NULL OR spi.status != 'disabled')
        AND s.status = 'active'
    `
    const queryParams = []
    let paramIndex = 1
    
    // 如果有目的地邮编，匹配 route_to
    if (destCode) {
      sql += ` AND (spi.route_to ILIKE $${paramIndex} OR spi.route_to ILIKE $${paramIndex + 1})`
      queryParams.push(`%${destCode}%`, `${destCode.substring(0, 2)}%`)
      paramIndex += 2
    }
    
    // 如果有起点，匹配 route_from
    if (originCode || origin) {
      const originMatch = originCode || origin
      sql += ` AND (spi.route_from ILIKE $${paramIndex} OR spi.route_from IS NULL OR spi.route_from = '')`
      queryParams.push(`%${originMatch}%`)
      paramIndex++
    }
    
    // 检查有效期
    sql += ` AND (spi.effective_date IS NULL OR spi.effective_date <= CURRENT_DATE)`
    sql += ` AND (spi.expiry_date IS NULL OR spi.expiry_date >= CURRENT_DATE)`
    
    sql += ` ORDER BY spi.price ASC LIMIT 20`
    
    const result = await db.pool.query(sql, queryParams)
    
    return result.rows.map(row => ({
      id: row.id,
      supplierId: row.supplier_id,
      supplierCode: row.supplier_code,
      supplierName: row.supplier_name,
      contactPerson: row.contact_person,
      contactPhone: row.contact_phone,
      feeName: row.fee_name,
      feeNameEn: row.fee_name_en,
      feeCategory: row.fee_category,
      unit: row.unit,
      price: parseFloat(row.price) || 0,
      currency: row.currency || 'EUR',
      routeFrom: row.route_from,
      routeTo: row.route_to,
      city: row.city,
      country: row.country,
      returnPoint: row.return_point,
      transportMode: row.transport_mode,
      billingType: row.billing_type || 'fixed',
      remark: row.remark,
      effectiveDate: row.effective_date,
      expiryDate: row.expiry_date
    }))
  } catch (error) {
    console.error('匹配运输报价失败:', error.message)
    return []
  }
}

/**
 * 获取运输报价概览（按路线分组）
 */
export async function getTransportPriceOverview(params = {}) {
  const db = getDatabase()
  const { supplierId, feeCategory } = params
  
  try {
    let sql = `
      SELECT 
        spi.route_from,
        spi.route_to,
        spi.fee_category,
        COUNT(DISTINCT spi.supplier_id) as supplier_count,
        MIN(spi.price) as min_price,
        MAX(spi.price) as max_price,
        AVG(spi.price) as avg_price,
        json_agg(
          json_build_object(
            'id', spi.id,
            'supplierId', spi.supplier_id,
            'supplierName', spi.supplier_name,
            'feeName', spi.fee_name,
            'price', spi.price,
            'currency', spi.currency,
            'unit', spi.unit,
            'effectiveDate', spi.effective_date,
            'expiryDate', spi.expiry_date
          )
        ) as suppliers
      FROM supplier_price_items spi
      LEFT JOIN suppliers s ON spi.supplier_id = s.id
      WHERE spi.fee_category IN ('transport', 'clearing_dispatching', 'express', 'freight')
        AND (spi.status IS NULL OR spi.status != 'disabled')
        AND (s.status IS NULL OR s.status = 'active')
        AND (spi.effective_date IS NULL OR spi.effective_date <= CURRENT_DATE)
        AND (spi.expiry_date IS NULL OR spi.expiry_date >= CURRENT_DATE)
    `
    
    const queryParams = []
    let paramIndex = 1
    
    if (supplierId) {
      sql += ` AND spi.supplier_id = $${paramIndex}`
      queryParams.push(supplierId)
      paramIndex++
    }
    
    if (feeCategory) {
      sql += ` AND spi.fee_category = $${paramIndex}`
      queryParams.push(feeCategory)
      paramIndex++
    }
    
    sql += `
      GROUP BY spi.route_from, spi.route_to, spi.fee_category
      ORDER BY supplier_count DESC, spi.route_from, spi.route_to
      LIMIT 100
    `
    
    const result = await db.pool.query(sql, queryParams)
    
    return result.rows.map(row => ({
      routeFrom: row.route_from || '任意',
      routeTo: row.route_to || '任意',
      feeCategory: row.fee_category,
      supplierCount: parseInt(row.supplier_count),
      minPrice: parseFloat(row.min_price) || 0,
      maxPrice: parseFloat(row.max_price) || 0,
      avgPrice: Math.round(parseFloat(row.avg_price) * 100) / 100 || 0,
      priceSpread: row.max_price && row.min_price 
        ? Math.round((parseFloat(row.max_price) - parseFloat(row.min_price)) * 100) / 100 
        : 0,
      suppliers: row.suppliers || []
    }))
  } catch (error) {
    console.error('获取运输报价概览失败:', error.message)
    return []
  }
}

export default {
  // 常量
  SUPPLIER_TYPES,
  SUPPLIER_STATUS,
  SUPPLIER_LEVELS,
  
  // 初始化
  initSupplierTable,
  
  // CRUD
  getSupplierList,
  getSupplierById,
  getSupplierByCode,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  batchDeleteSuppliers,
  updateSupplierStatus,
  
  // 工具函数
  checkSupplierCodeExists,
  getSupplierStats,
  generateSupplierCode,
  getActiveSuppliers,
  
  // 采购价管理
  getSupplierPrices,
  getSupplierPriceById,
  createSupplierPrice,
  updateSupplierPrice,
  deleteSupplierPrice,
  findSupplierPriceByName,
  
  // 批量导入
  batchCreateSupplierPrices,
  createImportRecord,
  getImportRecords,
  
  // 运输报价匹配与分析
  matchTransportPrices,
  getTransportPriceOverview
}
