/**
 * 货物导入服务
 * 处理Excel/CSV文件解析和数据导入
 */

import { getDatabase, generateId } from '../../config/database.js'
import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

// 模板字段映射
const FIELD_MAPPING = {
  '柜号': 'containerNo',
  '提单号': 'billNumber',
  '商品名称': 'productName',
  '英文品名': 'productNameEn',
  'HS编码': 'customerHsCode',
  '数量': 'quantity',
  '单位': 'unit',
  '单价': 'unitPrice',
  '单价(EUR)': 'unitPrice',
  '货值': 'totalValue',
  '货值(EUR)': 'totalValue',
  '毛重': 'grossWeight',
  '毛重(KG)': 'grossWeight',
  '净重': 'netWeight',
  '净重(KG)': 'netWeight',
  '原产国': 'originCountry',
  '材质': 'material'
}

/**
 * 生成导入批次号
 */
export function generateImportNo() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `IMP${year}${month}${day}${random}`
}

/**
 * 解析CSV文件内容
 */
export function parseCSVContent(content) {
  try {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true
    })
    return records
  } catch (error) {
    console.error('CSV解析失败:', error)
    throw new Error('CSV文件格式错误: ' + error.message)
  }
}

/**
 * 映射字段名
 */
export function mapFieldNames(record) {
  const mapped = {}
  for (const [key, value] of Object.entries(record)) {
    const fieldName = FIELD_MAPPING[key.trim()]
    if (fieldName) {
      mapped[fieldName] = value
    }
  }
  return mapped
}

/**
 * 校验单条数据
 */
export function validateItem(item, rowNo) {
  const errors = []

  // 必填字段校验
  if (!item.containerNo || !item.containerNo.trim()) {
    errors.push('柜号必填')
  }
  if (!item.productName || !item.productName.trim()) {
    errors.push('商品名称必填')
  }
  
  const quantity = parseFloat(item.quantity)
  if (isNaN(quantity) || quantity <= 0) {
    errors.push('数量必须大于0')
  }
  
  if (!item.unit || !item.unit.trim()) {
    errors.push('单位必填')
  }
  
  const unitPrice = parseFloat(item.unitPrice)
  if (isNaN(unitPrice) || unitPrice <= 0) {
    errors.push('单价必须大于0')
  }
  
  const grossWeight = parseFloat(item.grossWeight)
  if (isNaN(grossWeight) || grossWeight <= 0) {
    errors.push('毛重必须大于0')
  }
  
  if (!item.originCountry || !item.originCountry.trim()) {
    errors.push('原产国必填')
  }

  return {
    rowNo,
    containerNo: item.containerNo?.trim() || '',
    billNumber: item.billNumber?.trim() || '',
    productName: item.productName?.trim() || '',
    productNameEn: item.productNameEn?.trim() || '',
    hsCode: item.customerHsCode?.trim() || '',
    quantity: quantity || 0,
    unit: item.unit?.trim() || '',
    unitPrice: unitPrice || 0,
    totalValue: parseFloat(item.totalValue) || (quantity * unitPrice) || 0,
    grossWeight: grossWeight || 0,
    netWeight: parseFloat(item.netWeight) || 0,
    originCountry: item.originCountry?.trim() || '',
    material: item.material?.trim() || '',
    error: errors.length > 0 ? errors.join('; ') : null
  }
}

/**
 * 解析并预览文件数据
 */
export async function parseAndPreview(fileContent, fileType) {
  const items = []
  
  if (fileType === 'csv') {
    const records = parseCSVContent(fileContent)
    for (let i = 0; i < records.length; i++) {
      const mapped = mapFieldNames(records[i])
      const validated = validateItem(mapped, i + 1)
      items.push(validated)
    }
  }
  
  return {
    items,
    totalCount: items.length,
    validCount: items.filter(i => !i.error).length,
    errorCount: items.filter(i => i.error).length
  }
}

/**
 * 创建货物导入批次
 */
export async function createImportBatch(data) {
  const db = getDatabase()
  const importNo = generateImportNo()
  const now = new Date().toISOString()

  const result = await db.prepare(`
    INSERT INTO cargo_imports (
      import_no, customer_id, customer_name, container_no, bill_number,
      origin_country_code, total_items, status, import_file_name, import_file_path,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    importNo,
    data.customerId || null,
    data.customerName || null,
    data.containerNo || null,
    data.billNumber || null,
    data.originCountryCode || null,
    data.totalItems || 0,
    'pending',
    data.fileName || null,
    data.filePath || null,
    data.createdBy || null,
    now,
    now
  )

  return { id: result.id, importNo }
}

/**
 * 批量插入货物明细
 */
export async function insertCargoItems(importId, items) {
  const db = getDatabase()
  const now = new Date().toISOString()
  let insertedCount = 0
  let skippedCount = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    
    // 跳过有错误的数据
    if (item.error) {
      skippedCount++
      continue
    }

    await db.prepare(`
      INSERT INTO cargo_items (
        import_id, item_no, product_name, product_name_en, customer_hs_code,
        quantity, unit_code, unit_name, unit_price, total_value,
        gross_weight, net_weight, origin_country, material,
        match_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      importId,
      item.rowNo || (i + 1),
      item.productName,
      item.productNameEn || null,
      item.hsCode || null,
      item.quantity,
      item.unit,
      item.unit,
      item.unitPrice,
      item.totalValue,
      item.grossWeight,
      item.netWeight || null,
      item.originCountry,
      item.material || null,
      'pending',
      now
    )
    insertedCount++
  }

  // 更新导入批次的商品总数
  await db.prepare(`
    UPDATE cargo_imports 
    SET total_items = ?, updated_at = ?
    WHERE id = ?
  `).run(insertedCount, now, importId)

  return { insertedCount, skippedCount }
}

/**
 * 获取导入批次列表
 */
export async function getImportList(params = {}) {
  const db = getDatabase()
  const { page = 1, pageSize = 20, status, customerName, containerNo } = params

  let whereClause = 'WHERE 1=1'
  const queryParams = []

  if (status) {
    whereClause += ' AND status = ?'
    queryParams.push(status)
  }
  if (customerName) {
    whereClause += ' AND customer_name ILIKE ?'
    queryParams.push(`%${customerName}%`)
  }
  if (containerNo) {
    whereClause += ' AND container_no ILIKE ?'
    queryParams.push(`%${containerNo}%`)
  }

  // 获取总数
  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM cargo_imports ${whereClause}`
  ).get(...queryParams)
  const total = parseInt(countResult?.total) || 0

  // 分页查询
  const offset = (page - 1) * pageSize
  const listParams = [...queryParams, pageSize, offset]
  
  const rows = await db.prepare(`
    SELECT * FROM cargo_imports 
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...listParams)

  return {
    list: (rows || []).map(row => ({
      id: row.id,
      importNo: row.import_no,
      customerName: row.customer_name,
      containerNo: row.container_no,
      billNumber: row.bill_number,
      totalItems: row.total_items,
      matchedItems: row.matched_items,
      pendingItems: row.pending_items,
      status: row.status,
      importFileName: row.import_file_name,
      createdAt: row.created_at
    })),
    total,
    page,
    pageSize
  }
}

/**
 * 获取导入批次详情
 */
export async function getImportById(id) {
  const db = getDatabase()
  const row = await db.prepare('SELECT * FROM cargo_imports WHERE id = ?').get(id)
  
  if (!row) return null

  return {
    id: row.id,
    importNo: row.import_no,
    customerId: row.customer_id,
    customerName: row.customer_name,
    containerNo: row.container_no,
    billNumber: row.bill_number,
    originCountryCode: row.origin_country_code,
    totalItems: row.total_items,
    matchedItems: row.matched_items,
    pendingItems: row.pending_items,
    totalValue: parseFloat(row.total_value) || 0,
    totalDuty: parseFloat(row.total_duty) || 0,
    totalVat: parseFloat(row.total_vat) || 0,
    totalOtherTax: parseFloat(row.total_other_tax) || 0,
    customerConfirmed: row.customer_confirmed,
    customerConfirmedAt: row.customer_confirmed_at,
    confirmPdfPath: row.confirm_pdf_path,
    status: row.status,
    importFileName: row.import_file_name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * 获取货物明细列表
 */
export async function getCargoItems(importId, params = {}) {
  const db = getDatabase()
  const { page = 1, pageSize = 50, matchStatus } = params

  let whereClause = 'WHERE import_id = ?'
  const queryParams = [importId]

  if (matchStatus) {
    whereClause += ' AND match_status = ?'
    queryParams.push(matchStatus)
  }

  // 获取总数
  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM cargo_items ${whereClause}`
  ).get(...queryParams)
  const total = parseInt(countResult?.total) || 0

  // 分页查询
  const offset = (page - 1) * pageSize
  const listParams = [...queryParams, pageSize, offset]

  const rows = await db.prepare(`
    SELECT * FROM cargo_items 
    ${whereClause}
    ORDER BY item_no ASC
    LIMIT ? OFFSET ?
  `).all(...listParams)

  return {
    list: (rows || []).map(row => ({
      id: row.id,
      importId: row.import_id,
      itemNo: row.item_no,
      productName: row.product_name,
      productNameEn: row.product_name_en,
      customerHsCode: row.customer_hs_code,
      matchedHsCode: row.matched_hs_code,
      matchConfidence: parseFloat(row.match_confidence) || 0,
      matchSource: row.match_source,
      quantity: parseFloat(row.quantity) || 0,
      unitCode: row.unit_code,
      unitName: row.unit_name,
      unitPrice: parseFloat(row.unit_price) || 0,
      totalValue: parseFloat(row.total_value) || 0,
      grossWeight: parseFloat(row.gross_weight) || 0,
      netWeight: parseFloat(row.net_weight) || 0,
      originCountry: row.origin_country,
      material: row.material,
      dutyRate: parseFloat(row.duty_rate) || 0,
      vatRate: parseFloat(row.vat_rate) || 19,
      antiDumpingRate: parseFloat(row.anti_dumping_rate) || 0,
      countervailingRate: parseFloat(row.countervailing_rate) || 0,
      dutyAmount: parseFloat(row.duty_amount) || 0,
      vatAmount: parseFloat(row.vat_amount) || 0,
      otherTaxAmount: parseFloat(row.other_tax_amount) || 0,
      totalTax: parseFloat(row.total_tax) || 0,
      matchStatus: row.match_status,
      reviewNote: row.review_note,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at
    })),
    total,
    page,
    pageSize
  }
}

/**
 * 删除导入批次及相关数据
 */
export async function deleteImportBatch(id) {
  const db = getDatabase()
  
  // 删除货物明细（由于外键CASCADE，也可以只删除主表）
  await db.prepare('DELETE FROM cargo_items WHERE import_id = ?').run(id)
  
  // 删除导入批次
  const result = await db.prepare('DELETE FROM cargo_imports WHERE id = ?').run(id)
  
  return result.changes > 0
}

/**
 * 更新导入批次状态
 */
export async function updateImportStatus(id, status) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const result = await db.prepare(`
    UPDATE cargo_imports 
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(status, now, id)
  
  return result.changes > 0
}

/**
 * 更新导入批次统计信息
 */
export async function updateImportStats(importId) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 计算匹配统计
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN match_status IN ('matched', 'approved', 'auto_approved') THEN 1 ELSE 0 END) as matched,
      SUM(CASE WHEN match_status = 'pending' OR match_status = 'review' THEN 1 ELSE 0 END) as pending,
      COALESCE(SUM(total_value), 0) as total_value,
      COALESCE(SUM(duty_amount), 0) as total_duty,
      COALESCE(SUM(vat_amount), 0) as total_vat,
      COALESCE(SUM(other_tax_amount), 0) as total_other_tax
    FROM cargo_items 
    WHERE import_id = ?
  `).get(importId)
  
  await db.prepare(`
    UPDATE cargo_imports SET
      total_items = ?,
      matched_items = ?,
      pending_items = ?,
      total_value = ?,
      total_duty = ?,
      total_vat = ?,
      total_other_tax = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    parseInt(stats?.total) || 0,
    parseInt(stats?.matched) || 0,
    parseInt(stats?.pending) || 0,
    parseFloat(stats?.total_value) || 0,
    parseFloat(stats?.total_duty) || 0,
    parseFloat(stats?.total_vat) || 0,
    parseFloat(stats?.total_other_tax) || 0,
    now,
    importId
  )
}

export default {
  generateImportNo,
  parseCSVContent,
  mapFieldNames,
  validateItem,
  parseAndPreview,
  createImportBatch,
  insertCargoItems,
  getImportList,
  getImportById,
  getCargoItems,
  deleteImportBatch,
  updateImportStatus,
  updateImportStats
}
