/**
 * 统一报价中心 - 数据模型
 * 包含：费率卡查询、报价导入模板、导入记录、利润分析
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== 报价导入模板管理 ====================

/**
 * 获取导入模板列表
 */
export async function getImportTemplates(params = {}) {
  const db = getDatabase()
  const { carrierId, isActive, search, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT t.*, c.carrier_name, c.carrier_code FROM rate_import_templates t LEFT JOIN last_mile_carriers c ON t.carrier_id = c.id WHERE 1=1'
  const queryParams = []
  
  if (carrierId) {
    query += ' AND t.carrier_id = ?'
    queryParams.push(carrierId)
  }
  
  if (isActive !== undefined) {
    query += ' AND t.is_active = ?'
    queryParams.push(isActive ? 1 : 0)
  }
  
  if (search) {
    query += ' AND (t.template_name LIKE ? OR t.template_code LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT t.*, c.carrier_name, c.carrier_code', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertTemplateToCamelCase),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 根据ID获取导入模板
 */
export async function getImportTemplateById(id) {
  const db = getDatabase()
  const template = await db.prepare(`
    SELECT t.*, c.carrier_name, c.carrier_code 
    FROM rate_import_templates t 
    LEFT JOIN last_mile_carriers c ON t.carrier_id = c.id 
    WHERE t.id = ?
  `).get(id)
  return template ? convertTemplateToCamelCase(template) : null
}

/**
 * 根据编码获取导入模板
 */
export async function getImportTemplateByCode(code) {
  const db = getDatabase()
  const template = await db.prepare(`
    SELECT t.*, c.carrier_name, c.carrier_code 
    FROM rate_import_templates t 
    LEFT JOIN last_mile_carriers c ON t.carrier_id = c.id 
    WHERE t.template_code = ?
  `).get(code)
  return template ? convertTemplateToCamelCase(template) : null
}

/**
 * 创建导入模板
 */
export async function createImportTemplate(data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    INSERT INTO rate_import_templates (
      carrier_id, template_name, template_code, file_type, sheet_name,
      header_row, data_start_row, column_mapping, parse_config, preprocess_rules,
      is_active, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    data.carrierId || null,
    data.templateName,
    data.templateCode || null,
    data.fileType || 'excel',
    data.sheetName || null,
    data.headerRow || 1,
    data.dataStartRow || 2,
    data.columnMapping ? JSON.stringify(data.columnMapping) : null,
    data.parseConfig ? JSON.stringify(data.parseConfig) : null,
    data.preprocessRules ? JSON.stringify(data.preprocessRules) : null,
    data.isActive !== false ? 1 : 0,
    data.createdBy || ''
  )
  
  return { id: result.id }
}

/**
 * 更新导入模板
 */
export async function updateImportTemplate(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    templateName: 'template_name',
    templateCode: 'template_code',
    fileType: 'file_type',
    sheetName: 'sheet_name',
    headerRow: 'header_row',
    dataStartRow: 'data_start_row'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (data.columnMapping !== undefined) {
    fields.push('column_mapping = ?')
    values.push(data.columnMapping ? JSON.stringify(data.columnMapping) : null)
  }
  
  if (data.parseConfig !== undefined) {
    fields.push('parse_config = ?')
    values.push(data.parseConfig ? JSON.stringify(data.parseConfig) : null)
  }
  
  if (data.preprocessRules !== undefined) {
    fields.push('preprocess_rules = ?')
    values.push(data.preprocessRules ? JSON.stringify(data.preprocessRules) : null)
  }
  
  if (data.isActive !== undefined) {
    fields.push('is_active = ?')
    values.push(data.isActive ? 1 : 0)
  }
  
  if (fields.length === 0) return false
  
  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)
  
  const result = await db.prepare(`UPDATE rate_import_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除导入模板
 */
export async function deleteImportTemplate(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM rate_import_templates WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 导入记录管理 ====================

/**
 * 获取导入记录列表
 */
export async function getImportLogs(params = {}) {
  const db = getDatabase()
  const { carrierId, status, startDate, endDate, page = 1, pageSize = 20 } = params
  
  let query = `
    SELECT l.*, c.carrier_name, c.carrier_code, t.template_name
    FROM rate_import_logs l 
    LEFT JOIN last_mile_carriers c ON l.carrier_id = c.id 
    LEFT JOIN rate_import_templates t ON l.template_id = t.id
    WHERE 1=1
  `
  const queryParams = []
  
  if (carrierId) {
    query += ' AND l.carrier_id = ?'
    queryParams.push(carrierId)
  }
  
  if (status) {
    query += ' AND l.status = ?'
    queryParams.push(status)
  }
  
  if (startDate) {
    query += ' AND l.created_at >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND l.created_at <= ?'
    queryParams.push(endDate)
  }
  
  // 获取总数
  const countQuery = query.replace(/SELECT l\.\*, c\.carrier_name.*?WHERE/, 'SELECT COUNT(*) as total FROM rate_import_logs l LEFT JOIN last_mile_carriers c ON l.carrier_id = c.id LEFT JOIN rate_import_templates t ON l.template_id = t.id WHERE')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertImportLogToCamelCase),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 根据ID获取导入记录
 */
export async function getImportLogById(id) {
  const db = getDatabase()
  const log = await db.prepare(`
    SELECT l.*, c.carrier_name, c.carrier_code, t.template_name
    FROM rate_import_logs l 
    LEFT JOIN last_mile_carriers c ON l.carrier_id = c.id 
    LEFT JOIN rate_import_templates t ON l.template_id = t.id
    WHERE l.id = ?
  `).get(id)
  return log ? convertImportLogToCamelCase(log) : null
}

/**
 * 创建导入记录
 */
export async function createImportLog(data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    INSERT INTO rate_import_logs (
      carrier_id, template_id, rate_card_id, file_name, file_url, file_type,
      status, total_rows, success_rows, failed_rows, parsed_data, error_details, imported_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    data.carrierId || null,
    data.templateId || null,
    data.rateCardId || null,
    data.fileName || '',
    data.fileUrl || null,
    data.fileType || '',
    data.status || 'pending',
    data.totalRows || 0,
    data.successRows || 0,
    data.failedRows || 0,
    data.parsedData ? JSON.stringify(data.parsedData) : null,
    data.errorDetails ? JSON.stringify(data.errorDetails) : null,
    data.importedBy || ''
  )
  
  return { id: result.id }
}

/**
 * 更新导入记录
 */
export async function updateImportLog(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    rateCardId: 'rate_card_id',
    status: 'status',
    totalRows: 'total_rows',
    successRows: 'success_rows',
    failedRows: 'failed_rows',
    confirmedBy: 'confirmed_by'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (data.parsedData !== undefined) {
    fields.push('parsed_data = ?')
    values.push(data.parsedData ? JSON.stringify(data.parsedData) : null)
  }
  
  if (data.errorDetails !== undefined) {
    fields.push('error_details = ?')
    values.push(data.errorDetails ? JSON.stringify(data.errorDetails) : null)
  }
  
  if (data.confirmedAt !== undefined) {
    fields.push('confirmed_at = ?')
    values.push(data.confirmedAt)
  }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const result = await db.prepare(`UPDATE rate_import_logs SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

// ==================== 费率卡综合查询 ====================

/**
 * 获取有效的费率卡（用于计价）
 */
export async function getActiveRateCard(params = {}) {
  const db = getDatabase()
  const { carrierId, rateType, serviceType, date } = params
  
  const queryDate = date || new Date().toISOString().split('T')[0]
  
  let query = `
    SELECT r.*, c.carrier_name, c.carrier_code 
    FROM unified_rate_cards r 
    LEFT JOIN last_mile_carriers c ON r.carrier_id = c.id
    WHERE r.status = 'active' 
    AND r.valid_from <= ? 
    AND (r.valid_until IS NULL OR r.valid_until >= ?)
  `
  const queryParams = [queryDate, queryDate]
  
  if (carrierId) {
    query += ' AND r.carrier_id = ?'
    queryParams.push(carrierId)
  }
  
  if (rateType) {
    query += ' AND r.rate_type = ?'
    queryParams.push(rateType)
  }
  
  if (serviceType) {
    query += ' AND r.service_type = ?'
    queryParams.push(serviceType)
  }
  
  // 优先返回默认的，或最新创建的
  query += ' ORDER BY r.is_default DESC, r.created_at DESC LIMIT 1'
  
  const rateCard = await db.prepare(query).get(...queryParams)
  return rateCard ? convertRateCardToCamelCase(rateCard) : null
}

/**
 * 获取费率卡的所有费率明细（按Zone分组）
 */
export async function getRateCardTiersByZone(rateCardId) {
  const db = getDatabase()
  
  const tiers = await db.prepare(`
    SELECT t.*, z.zone_name 
    FROM rate_card_tiers t
    LEFT JOIN last_mile_zones z ON t.zone_id = z.id
    WHERE t.rate_card_id = ?
    ORDER BY t.zone_code, t.weight_from
  `).all(rateCardId)
  
  // 按Zone分组
  const grouped = {}
  tiers.forEach(tier => {
    const zoneCode = tier.zone_code || 'default'
    if (!grouped[zoneCode]) {
      grouped[zoneCode] = {
        zoneCode,
        zoneName: tier.zone_name || zoneCode,
        tiers: []
      }
    }
    grouped[zoneCode].tiers.push({
      id: tier.id,
      weightFrom: parseFloat(tier.weight_from) || 0,
      weightTo: parseFloat(tier.weight_to) || 0,
      purchasePrice: tier.purchase_price ? parseFloat(tier.purchase_price) : null,
      purchaseMinCharge: tier.purchase_min_charge ? parseFloat(tier.purchase_min_charge) : null,
      salesPrice: tier.sales_price ? parseFloat(tier.sales_price) : null,
      salesMinCharge: tier.sales_min_charge ? parseFloat(tier.sales_min_charge) : null,
      priceUnit: tier.price_unit,
      marginRate: tier.margin_rate ? parseFloat(tier.margin_rate) : null,
      marginAmount: tier.margin_amount ? parseFloat(tier.margin_amount) : null
    })
  })
  
  return Object.values(grouped)
}

/**
 * 查询指定重量的费率
 */
export async function findRateTier(rateCardId, zoneCode, weight) {
  const db = getDatabase()
  
  const tier = await db.prepare(`
    SELECT * FROM rate_card_tiers 
    WHERE rate_card_id = ? 
    AND zone_code = ? 
    AND weight_from <= ? 
    AND weight_to >= ?
    ORDER BY weight_from DESC
    LIMIT 1
  `).get(rateCardId, zoneCode, weight, weight)
  
  if (!tier) return null
  
  return {
    id: tier.id,
    weightFrom: parseFloat(tier.weight_from) || 0,
    weightTo: parseFloat(tier.weight_to) || 0,
    purchasePrice: tier.purchase_price ? parseFloat(tier.purchase_price) : null,
    purchaseMinCharge: tier.purchase_min_charge ? parseFloat(tier.purchase_min_charge) : null,
    salesPrice: tier.sales_price ? parseFloat(tier.sales_price) : null,
    salesMinCharge: tier.sales_min_charge ? parseFloat(tier.sales_min_charge) : null,
    priceUnit: tier.price_unit,
    marginRate: tier.margin_rate ? parseFloat(tier.margin_rate) : null,
    marginAmount: tier.margin_amount ? parseFloat(tier.margin_amount) : null
  }
}

/**
 * 获取费率卡的附加费
 */
export async function getRateCardSurcharges(rateCardId) {
  const db = getDatabase()
  
  const surcharges = await db.prepare(`
    SELECT * FROM rate_card_surcharges WHERE rate_card_id = ?
  `).all(rateCardId)
  
  return surcharges.map(s => ({
    id: s.id,
    surchargeCode: s.surcharge_code,
    surchargeName: s.surcharge_name,
    surchargeNameEn: s.surcharge_name_en,
    chargeType: s.charge_type,
    purchaseAmount: s.purchase_amount ? parseFloat(s.purchase_amount) : null,
    salesAmount: s.sales_amount ? parseFloat(s.sales_amount) : null,
    percentage: s.percentage ? parseFloat(s.percentage) : null,
    isMandatory: s.is_mandatory === 1,
    conditions: s.conditions ? JSON.parse(s.conditions) : null
  }))
}

// ==================== 利润分析 ====================

/**
 * 获取费率卡利润汇总
 */
export async function getRateCardProfitSummary(rateCardId) {
  const db = getDatabase()
  
  const summary = await db.prepare(`
    SELECT 
      COUNT(*) as tier_count,
      AVG(CASE WHEN purchase_price > 0 THEN (sales_price - purchase_price) / purchase_price * 100 END) as avg_margin_rate,
      SUM(CASE WHEN purchase_price IS NOT NULL AND sales_price IS NOT NULL THEN 1 ELSE 0 END) as priced_count,
      MIN(purchase_price) as min_purchase,
      MAX(purchase_price) as max_purchase,
      MIN(sales_price) as min_sales,
      MAX(sales_price) as max_sales
    FROM rate_card_tiers
    WHERE rate_card_id = ?
  `).get(rateCardId)
  
  return {
    tierCount: summary.tier_count || 0,
    pricedCount: summary.priced_count || 0,
    avgMarginRate: summary.avg_margin_rate ? parseFloat(summary.avg_margin_rate.toFixed(2)) : 0,
    purchaseRange: {
      min: summary.min_purchase ? parseFloat(summary.min_purchase) : 0,
      max: summary.max_purchase ? parseFloat(summary.max_purchase) : 0
    },
    salesRange: {
      min: summary.min_sales ? parseFloat(summary.min_sales) : 0,
      max: summary.max_sales ? parseFloat(summary.max_sales) : 0
    }
  }
}

/**
 * 获取承运商利润统计（基于运单数据）
 */
export async function getCarrierProfitStats(params = {}) {
  const db = getDatabase()
  const { carrierId, startDate, endDate } = params
  
  let query = `
    SELECT 
      carrier_id,
      carrier_code,
      COUNT(*) as shipment_count,
      SUM(weight) as total_weight,
      SUM(purchase_cost) as total_purchase,
      SUM(sales_amount) as total_sales,
      SUM(profit_amount) as total_profit,
      AVG(CASE WHEN purchase_cost > 0 THEN profit_amount / purchase_cost * 100 END) as avg_profit_rate
    FROM last_mile_shipments
    WHERE status != 'pending'
  `
  const queryParams = []
  
  if (carrierId) {
    query += ' AND carrier_id = ?'
    queryParams.push(carrierId)
  }
  
  if (startDate) {
    query += ' AND created_at >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND created_at <= ?'
    queryParams.push(endDate)
  }
  
  query += ' GROUP BY carrier_id, carrier_code'
  
  const stats = await db.prepare(query).all(...queryParams)
  
  return stats.map(s => ({
    carrierId: s.carrier_id,
    carrierCode: s.carrier_code,
    shipmentCount: s.shipment_count || 0,
    totalWeight: s.total_weight ? parseFloat(s.total_weight) : 0,
    totalPurchase: s.total_purchase ? parseFloat(s.total_purchase) : 0,
    totalSales: s.total_sales ? parseFloat(s.total_sales) : 0,
    totalProfit: s.total_profit ? parseFloat(s.total_profit) : 0,
    avgProfitRate: s.avg_profit_rate ? parseFloat(s.avg_profit_rate.toFixed(2)) : 0
  }))
}

// ==================== 数据转换函数 ====================

function convertTemplateToCamelCase(row) {
  if (!row) return null
  return {
    id: row.id,
    carrierId: row.carrier_id,
    carrierName: row.carrier_name,
    carrierCode: row.carrier_code,
    templateName: row.template_name,
    templateCode: row.template_code,
    fileType: row.file_type,
    sheetName: row.sheet_name,
    headerRow: row.header_row,
    dataStartRow: row.data_start_row,
    columnMapping: row.column_mapping ? JSON.parse(row.column_mapping) : null,
    parseConfig: row.parse_config ? JSON.parse(row.parse_config) : null,
    preprocessRules: row.preprocess_rules ? JSON.parse(row.preprocess_rules) : null,
    isActive: row.is_active === 1,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function convertImportLogToCamelCase(row) {
  if (!row) return null
  return {
    id: row.id,
    carrierId: row.carrier_id,
    carrierName: row.carrier_name,
    carrierCode: row.carrier_code,
    templateId: row.template_id,
    templateName: row.template_name,
    rateCardId: row.rate_card_id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    fileType: row.file_type,
    status: row.status,
    totalRows: row.total_rows,
    successRows: row.success_rows,
    failedRows: row.failed_rows,
    parsedData: row.parsed_data ? JSON.parse(row.parsed_data) : null,
    errorDetails: row.error_details ? JSON.parse(row.error_details) : null,
    importedBy: row.imported_by,
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at
  }
}

function convertRateCardToCamelCase(row) {
  if (!row) return null
  return {
    id: row.id,
    rateCardCode: row.rate_card_code,
    rateCardName: row.rate_card_name,
    carrierId: row.carrier_id,
    carrierName: row.carrier_name,
    carrierCode: row.carrier_code,
    supplierId: row.supplier_id,
    rateType: row.rate_type,
    serviceType: row.service_type,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    currency: row.currency,
    status: row.status,
    isDefault: row.is_default === 1,
    importLogId: row.import_log_id,
    version: row.version,
    remark: row.remark,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export default {
  // 导入模板
  getImportTemplates,
  getImportTemplateById,
  getImportTemplateByCode,
  createImportTemplate,
  updateImportTemplate,
  deleteImportTemplate,
  
  // 导入记录
  getImportLogs,
  getImportLogById,
  createImportLog,
  updateImportLog,
  
  // 费率卡查询
  getActiveRateCard,
  getRateCardTiersByZone,
  findRateTier,
  getRateCardSurcharges,
  
  // 利润分析
  getRateCardProfitSummary,
  getCarrierProfitStats
}
