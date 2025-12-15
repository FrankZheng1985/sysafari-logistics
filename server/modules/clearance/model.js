/**
 * 清关单证模块 - 数据模型
 * 用于管理订单的货物清关数据
 */

import { getDatabase } from '../../config/database.js'
import { generateId } from '../../utils/id.js'

// ==================== 单证类型管理 ====================

/**
 * 获取单证类型列表
 */
export async function getDocumentTypes(params = {}) {
  const db = getDatabase()
  const { status = 'active' } = params
  
  let query = 'SELECT * FROM clearance_document_types WHERE 1=1'
  const queryParams = []
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  query += ' ORDER BY sort_order ASC'
  
  const list = await db.prepare(query).all(...queryParams)
  
  return list.map(row => ({
    id: row.id,
    code: row.code,
    nameCn: row.name_cn,
    nameEn: row.name_en,
    description: row.description,
    requiredFields: row.required_fields ? JSON.parse(row.required_fields) : [],
    sortOrder: row.sort_order,
    status: row.status
  }))
}

// ==================== 清关单证管理 ====================

/**
 * 获取清关单证列表
 */
export async function getClearanceDocuments(params = {}) {
  const db = getDatabase()
  const { 
    billId, billNumber, documentType, status, 
    reviewStatus, search, startDate, endDate,
    page = 1, pageSize = 20 
  } = params
  
  let query = 'SELECT * FROM clearance_documents WHERE 1=1'
  const queryParams = []
  
  if (billId) {
    query += ' AND bill_id = ?'
    queryParams.push(billId)
  }
  
  if (billNumber) {
    query += ' AND bill_number LIKE ?'
    queryParams.push(`%${billNumber}%`)
  }
  
  if (documentType) {
    query += ' AND document_type = ?'
    queryParams.push(documentType)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (reviewStatus) {
    query += ' AND review_status = ?'
    queryParams.push(reviewStatus)
  }
  
  if (search) {
    query += ` AND (document_no LIKE ? OR shipper_name LIKE ? OR consignee_name LIKE ? OR goods_description LIKE ?)`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern)
  }
  
  if (startDate) {
    query += ' AND created_at >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND created_at <= ?'
    queryParams.push(endDate + ' 23:59:59')
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
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
 * 获取清关单证统计
 */
export async function getClearanceStats(params = {}) {
  const db = getDatabase()
  const { billId } = params
  
  let whereClause = 'WHERE 1=1'
  const queryParams = []
  
  if (billId) {
    whereClause += ' AND bill_id = ?'
    queryParams.push(billId)
  }
  
  // 按单证类型统计
  const byType = await db.prepare(`
    SELECT document_type, document_type_name, COUNT(*) as count
    FROM clearance_documents ${whereClause}
    GROUP BY document_type, document_type_name
    ORDER BY count DESC
  `).all(...queryParams)
  
  // 按状态统计
  const byStatus = await db.prepare(`
    SELECT status, COUNT(*) as count
    FROM clearance_documents ${whereClause}
    GROUP BY status
  `).all(...queryParams)
  
  // 按审核状态统计
  const byReviewStatus = await db.prepare(`
    SELECT review_status, COUNT(*) as count
    FROM clearance_documents ${whereClause}
    GROUP BY review_status
  `).all(...queryParams)
  
  // 总计
  const total = await db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(total_value), 0) as total_value
    FROM clearance_documents ${whereClause}
  `).get(...queryParams)
  
  return {
    total: {
      count: total?.count || 0,
      totalValue: total?.total_value || 0
    },
    byType: byType.map(t => ({
      type: t.document_type,
      typeName: t.document_type_name,
      count: t.count
    })),
    byStatus: byStatus.map(s => ({
      status: s.status,
      count: s.count
    })),
    byReviewStatus: byReviewStatus.map(r => ({
      reviewStatus: r.review_status,
      count: r.count
    }))
  }
}

/**
 * 根据ID获取清关单证
 */
export async function getClearanceDocumentById(id) {
  const db = getDatabase()
  const doc = await db.prepare('SELECT * FROM clearance_documents WHERE id = ?').get(id)
  if (!doc) return null
  
  // 获取明细
  const items = await db.prepare('SELECT * FROM clearance_document_items WHERE document_id = ? ORDER BY item_no').all(id)
  
  const result = convertToCamelCase(doc)
  result.items = items.map(item => ({
    id: item.id,
    itemNo: item.item_no,
    description: item.description,
    hsCode: item.hs_code,
    quantity: item.quantity,
    quantityUnit: item.quantity_unit,
    unitPrice: item.unit_price,
    totalPrice: item.total_price,
    grossWeight: item.gross_weight,
    netWeight: item.net_weight,
    volume: item.volume,
    countryOfOrigin: item.country_of_origin,
    remark: item.remark
  }))
  
  return result
}

/**
 * 根据订单获取清关单证
 */
export async function getClearanceDocumentsByBill(billId) {
  const db = getDatabase()
  const docs = await db.prepare(`
    SELECT * FROM clearance_documents 
    WHERE bill_id = ?
    ORDER BY document_type, created_at DESC
  `).all(billId)
  
  return docs.map(convertToCamelCase)
}

/**
 * 生成单证编号
 */
export async function generateDocumentNo(documentType) {
  const db = getDatabase()
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = documentType || 'DOC'
  
  // 获取当日最大序号
  const result = await db.prepare(`
    SELECT MAX(CAST(SUBSTR(document_no, -4) AS INTEGER)) as max_seq
    FROM clearance_documents
    WHERE document_no LIKE ?
  `).get(`${prefix}${dateStr}%`)
  
  const nextSeq = (result?.max_seq || 0) + 1
  return `${prefix}${dateStr}${String(nextSeq).padStart(4, '0')}`
}

/**
 * 创建清关单证
 */
export async function createClearanceDocument(data) {
  const db = getDatabase()
  const id = generateId()
  const documentNo = data.documentNo || generateDocumentNo(data.documentType)
  
  const result = await db.prepare(`
    INSERT INTO clearance_documents (
      id, document_no, bill_id, bill_number, document_type, document_type_name,
      shipper_name, shipper_address, shipper_contact,
      consignee_name, consignee_address, consignee_contact, notify_party,
      goods_description, hs_code, quantity, quantity_unit,
      gross_weight, net_weight, weight_unit, volume, volume_unit,
      packages, package_type,
      currency, total_value, unit_price, freight_amount, insurance_amount,
      transport_method, vessel_name, voyage_no,
      port_of_loading, port_of_discharge,
      country_of_origin, country_of_destination,
      etd, eta,
      customs_broker, customs_entry_no, customs_release_date,
      duty_amount, tax_amount,
      status, review_status, remark, attachments,
      created_by, created_by_name, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime')
    )
  `).run(
    id, documentNo, data.billId || null, data.billNumber || null,
    data.documentType, data.documentTypeName || '',
    data.shipperName || '', data.shipperAddress || '', data.shipperContact || '',
    data.consigneeName || '', data.consigneeAddress || '', data.consigneeContact || '', data.notifyParty || '',
    data.goodsDescription || '', data.hsCode || '', data.quantity || 0, data.quantityUnit || 'PCS',
    data.grossWeight || 0, data.netWeight || 0, data.weightUnit || 'KGS',
    data.volume || 0, data.volumeUnit || 'CBM',
    data.packages || 0, data.packageType || '',
    data.currency || 'USD', data.totalValue || 0, data.unitPrice || 0,
    data.freightAmount || 0, data.insuranceAmount || 0,
    data.transportMethod || '', data.vesselName || '', data.voyageNo || '',
    data.portOfLoading || '', data.portOfDischarge || '',
    data.countryOfOrigin || '', data.countryOfDestination || '',
    data.etd || null, data.eta || null,
    data.customsBroker || '', data.customsEntryNo || '', data.customsReleaseDate || null,
    data.dutyAmount || 0, data.taxAmount || 0,
    data.status || 'draft', data.reviewStatus || 'pending',
    data.remark || '', data.attachments ? JSON.stringify(data.attachments) : '[]',
    data.createdBy || null, data.createdByName || ''
  )
  
  // 插入明细
  if (data.items && data.items.length > 0) {
    const insertItem = await db.prepare(`
      INSERT INTO clearance_document_items (
        id, document_id, item_no, description, hs_code,
        quantity, quantity_unit, unit_price, total_price,
        gross_weight, net_weight, volume, country_of_origin, remark,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `)
    
    data.items.forEach((item, index) => {
      insertItem.run(
        generateId(), id, index + 1,
        item.description || '', item.hsCode || '',
        item.quantity || 0, item.quantityUnit || 'PCS',
        item.unitPrice || 0, item.totalPrice || 0,
        item.grossWeight || 0, item.netWeight || 0, item.volume || 0,
        item.countryOfOrigin || '', item.remark || ''
      )
    })
  }
  
  return { id, documentNo }
}

/**
 * 更新清关单证
 */
export async function updateClearanceDocument(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    billId: 'bill_id',
    billNumber: 'bill_number',
    documentType: 'document_type',
    documentTypeName: 'document_type_name',
    shipperName: 'shipper_name',
    shipperAddress: 'shipper_address',
    shipperContact: 'shipper_contact',
    consigneeName: 'consignee_name',
    consigneeAddress: 'consignee_address',
    consigneeContact: 'consignee_contact',
    notifyParty: 'notify_party',
    goodsDescription: 'goods_description',
    hsCode: 'hs_code',
    quantity: 'quantity',
    quantityUnit: 'quantity_unit',
    grossWeight: 'gross_weight',
    netWeight: 'net_weight',
    weightUnit: 'weight_unit',
    volume: 'volume',
    volumeUnit: 'volume_unit',
    packages: 'packages',
    packageType: 'package_type',
    currency: 'currency',
    totalValue: 'total_value',
    unitPrice: 'unit_price',
    freightAmount: 'freight_amount',
    insuranceAmount: 'insurance_amount',
    transportMethod: 'transport_method',
    vesselName: 'vessel_name',
    voyageNo: 'voyage_no',
    portOfLoading: 'port_of_loading',
    portOfDischarge: 'port_of_discharge',
    countryOfOrigin: 'country_of_origin',
    countryOfDestination: 'country_of_destination',
    etd: 'etd',
    eta: 'eta',
    customsBroker: 'customs_broker',
    customsEntryNo: 'customs_entry_no',
    customsReleaseDate: 'customs_release_date',
    dutyAmount: 'duty_amount',
    taxAmount: 'tax_amount',
    status: 'status',
    reviewStatus: 'review_status',
    remark: 'remark'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (data.attachments !== undefined) {
    fields.push('attachments = ?')
    values.push(JSON.stringify(data.attachments))
  }
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = datetime('now', 'localtime')")
  values.push(id)
  
  const result = db.prepare(`UPDATE clearance_documents SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  
  // 更新明细（先删除再插入）
  if (data.items !== undefined) {
    await db.prepare('DELETE FROM clearance_document_items WHERE document_id = ?').run(id)
    
    if (data.items.length > 0) {
      const insertItem = await db.prepare(`
        INSERT INTO clearance_document_items (
          id, document_id, item_no, description, hs_code,
          quantity, quantity_unit, unit_price, total_price,
          gross_weight, net_weight, volume, country_of_origin, remark,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      `)
      
      data.items.forEach((item, index) => {
        insertItem.run(
          generateId(), id, index + 1,
          item.description || '', item.hsCode || '',
          item.quantity || 0, item.quantityUnit || 'PCS',
          item.unitPrice || 0, item.totalPrice || 0,
          item.grossWeight || 0, item.netWeight || 0, item.volume || 0,
          item.countryOfOrigin || '', item.remark || ''
        )
      })
    }
  }
  
  return result.changes > 0
}

/**
 * 删除清关单证
 */
export async function deleteClearanceDocument(id) {
  const db = getDatabase()
  
  // 删除明细
  await db.prepare('DELETE FROM clearance_document_items WHERE document_id = ?').run(id)
  
  // 删除主记录
  const result = await db.prepare('DELETE FROM clearance_documents WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 审核清关单证
 */
export async function reviewClearanceDocument(id, reviewStatus, reviewNote, reviewer) {
  const db = getDatabase()
  const result = db.prepare(`
    UPDATE clearance_documents 
    SET review_status = ?, review_note = ?, reviewer = ?, review_time = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(reviewStatus, reviewNote || '', reviewer || '', id)
  return result.changes > 0
}

/**
 * 更新清关单证状态
 */
export async function updateClearanceDocumentStatus(id, status) {
  const db = getDatabase()
  const result = await db.prepare(`
    UPDATE clearance_documents 
    SET status = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(status, id)
  return result.changes > 0
}

// ==================== 数据转换函数 ====================

function convertToCamelCase(row) {
  let attachments = []
  if (row.attachments) {
    try {
      attachments = JSON.parse(row.attachments)
    } catch (e) {
      attachments = []
    }
  }
  
  return {
    id: row.id,
    documentNo: row.document_no,
    billId: row.bill_id,
    billNumber: row.bill_number,
    documentType: row.document_type,
    documentTypeName: row.document_type_name,
    shipperName: row.shipper_name,
    shipperAddress: row.shipper_address,
    shipperContact: row.shipper_contact,
    consigneeName: row.consignee_name,
    consigneeAddress: row.consignee_address,
    consigneeContact: row.consignee_contact,
    notifyParty: row.notify_party,
    goodsDescription: row.goods_description,
    hsCode: row.hs_code,
    quantity: row.quantity,
    quantityUnit: row.quantity_unit,
    grossWeight: row.gross_weight,
    netWeight: row.net_weight,
    weightUnit: row.weight_unit,
    volume: row.volume,
    volumeUnit: row.volume_unit,
    packages: row.packages,
    packageType: row.package_type,
    currency: row.currency,
    totalValue: row.total_value,
    unitPrice: row.unit_price,
    freightAmount: row.freight_amount,
    insuranceAmount: row.insurance_amount,
    transportMethod: row.transport_method,
    vesselName: row.vessel_name,
    voyageNo: row.voyage_no,
    portOfLoading: row.port_of_loading,
    portOfDischarge: row.port_of_discharge,
    countryOfOrigin: row.country_of_origin,
    countryOfDestination: row.country_of_destination,
    etd: row.etd,
    eta: row.eta,
    customsBroker: row.customs_broker,
    customsEntryNo: row.customs_entry_no,
    customsReleaseDate: row.customs_release_date,
    dutyAmount: row.duty_amount,
    taxAmount: row.tax_amount,
    status: row.status,
    reviewStatus: row.review_status,
    reviewNote: row.review_note,
    reviewer: row.reviewer,
    reviewTime: row.review_time,
    remark: row.remark,
    attachments,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export default {
  getDocumentTypes,
  getClearanceDocuments,
  getClearanceStats,
  getClearanceDocumentById,
  getClearanceDocumentsByBill,
  generateDocumentNo,
  createClearanceDocument,
  updateClearanceDocument,
  deleteClearanceDocument,
  reviewClearanceDocument,
  updateClearanceDocumentStatus
}

