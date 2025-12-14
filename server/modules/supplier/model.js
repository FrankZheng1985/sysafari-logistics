/**
 * 供应商管理模块 - 数据模型
 * 包含：供应商基本信息、联系信息、财务信息等
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== 供应商类型常量 ====================

export const SUPPLIER_TYPES = {
  MANUFACTURER: 'manufacturer',    // 生产厂家
  TRADER: 'trader',                // 贸易商
  AGENT: 'agent',                  // 代理商
  DISTRIBUTOR: 'distributor',      // 分销商
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

export function initSupplierTable() {
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
      currency TEXT DEFAULT 'CNY',
      payment_terms TEXT,
      credit_limit REAL DEFAULT 0,
      
      -- 合作信息
      status TEXT DEFAULT 'active',
      level TEXT DEFAULT 'new',
      rating INTEGER DEFAULT 0,
      cooperation_date TEXT,
      contract_expire_date TEXT,
      
      -- 备注
      remark TEXT,
      
      -- 时间戳
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
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
export function getSupplierList(params = {}) {
  const db = getDatabase()
  const { 
    search, 
    type, 
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
  
  // 类型筛选
  if (type) {
    query += ' AND supplier_type = ?'
    queryParams.push(type)
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
  const totalResult = db.prepare(countQuery).get(...queryParams)
  
  // 分页和排序
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = db.prepare(query).all(...queryParams)
  
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
export function getSupplierById(id) {
  const db = getDatabase()
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id)
  return supplier ? convertToCamelCase(supplier) : null
}

/**
 * 根据编码获取供应商
 */
export function getSupplierByCode(code) {
  const db = getDatabase()
  const supplier = db.prepare('SELECT * FROM suppliers WHERE supplier_code = ?').get(code)
  return supplier ? convertToCamelCase(supplier) : null
}

/**
 * 创建供应商
 */
export function createSupplier(data) {
  const db = getDatabase()
  const id = generateId()
  
  const result = db.prepare(`
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
    data.currency || 'CNY',
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
export function updateSupplier(id, data) {
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
  fields.push('updated_at = datetime("now", "localtime")')
  values.push(id)
  
  const result = db.prepare(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除供应商
 */
export function deleteSupplier(id) {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM suppliers WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 批量删除供应商
 */
export function batchDeleteSuppliers(ids) {
  const db = getDatabase()
  const placeholders = ids.map(() => '?').join(',')
  const result = db.prepare(`DELETE FROM suppliers WHERE id IN (${placeholders})`).run(...ids)
  return result.changes
}

/**
 * 更新供应商状态
 */
export function updateSupplierStatus(id, status, updatedBy) {
  const db = getDatabase()
  const result = db.prepare(`
    UPDATE suppliers 
    SET status = ?, updated_at = datetime('now', 'localtime'), updated_by = ?
    WHERE id = ?
  `).run(status, updatedBy || '', id)
  return result.changes > 0
}

/**
 * 检查供应商编码是否存在
 */
export function checkSupplierCodeExists(code, excludeId = null) {
  const db = getDatabase()
  let query = 'SELECT COUNT(*) as count FROM suppliers WHERE supplier_code = ?'
  const params = [code]
  
  if (excludeId) {
    query += ' AND id != ?'
    params.push(excludeId)
  }
  
  const result = db.prepare(query).get(...params)
  return result.count > 0
}

/**
 * 获取供应商统计数据
 */
export function getSupplierStats() {
  const db = getDatabase()
  
  const stats = db.prepare(`
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
export function generateSupplierCode() {
  const db = getDatabase()
  const result = db.prepare(`
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
export function getActiveSuppliers() {
  const db = getDatabase()
  const list = db.prepare(`
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
  getActiveSuppliers
}
