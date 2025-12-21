/**
 * 最后里程模块 - 数据模型
 * 包含：承运商管理、Zone配置、费率卡、运单管理、结算管理
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== 常量定义 ====================

export const CARRIER_TYPES = {
  EXPRESS: 'express',       // 快递
  TRUCKING: 'trucking'      // 卡车
}

export const CARRIER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
}

export const RATE_TYPES = {
  LAST_MILE: 'last_mile',
  FREIGHT: 'freight',
  CLEARANCE: 'clearance',
  OTHER: 'other'
}

export const SERVICE_TYPES = {
  STANDARD: 'standard',
  EXPRESS: 'express',
  ECONOMY: 'economy'
}

export const SHIPMENT_STATUS = {
  PENDING: 'pending',
  CREATED: 'created',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  EXCEPTION: 'exception'
}

export const SETTLEMENT_STATUS = {
  PENDING: 'pending',
  RECONCILING: 'reconciling',
  CONFIRMED: 'confirmed',
  DISPUTED: 'disputed'
}

export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid'
}

// ==================== 承运商管理 ====================

/**
 * 获取承运商列表
 */
export async function getCarriers(params = {}) {
  const db = getDatabase()
  const { type, status, search, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM last_mile_carriers WHERE 1=1'
  const queryParams = []
  
  if (type) {
    query += ' AND carrier_type = ?'
    queryParams.push(type)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (search) {
    query += ' AND (carrier_code LIKE ? OR carrier_name LIKE ? OR carrier_name_en LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY carrier_code LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertCarrierToCamelCase),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 根据ID获取承运商
 */
export async function getCarrierById(id) {
  const db = getDatabase()
  const carrier = await db.prepare('SELECT * FROM last_mile_carriers WHERE id = ?').get(id)
  return carrier ? convertCarrierToCamelCase(carrier) : null
}

/**
 * 根据编码获取承运商
 */
export async function getCarrierByCode(code) {
  const db = getDatabase()
  const carrier = await db.prepare('SELECT * FROM last_mile_carriers WHERE carrier_code = ?').get(code)
  return carrier ? convertCarrierToCamelCase(carrier) : null
}

/**
 * 创建承运商
 */
export async function createCarrier(data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    INSERT INTO last_mile_carriers (
      carrier_code, carrier_name, carrier_name_en, carrier_type,
      country_code, service_region, contact_person, contact_phone, contact_email,
      website, api_enabled, api_config, status, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    data.carrierCode,
    data.carrierName,
    data.carrierNameEn || '',
    data.carrierType || 'express',
    data.countryCode || 'DE',
    data.serviceRegion || '',
    data.contactPerson || '',
    data.contactPhone || '',
    data.contactEmail || '',
    data.website || '',
    data.apiEnabled ? 1 : 0,
    data.apiConfig ? JSON.stringify(data.apiConfig) : null,
    data.status || 'active',
    data.remark || ''
  )
  
  return { id: result.id }
}

/**
 * 更新承运商
 */
export async function updateCarrier(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    carrierCode: 'carrier_code',
    carrierName: 'carrier_name',
    carrierNameEn: 'carrier_name_en',
    carrierType: 'carrier_type',
    countryCode: 'country_code',
    serviceRegion: 'service_region',
    contactPerson: 'contact_person',
    contactPhone: 'contact_phone',
    contactEmail: 'contact_email',
    website: 'website',
    status: 'status',
    remark: 'remark'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (data.apiEnabled !== undefined) {
    fields.push('api_enabled = ?')
    values.push(data.apiEnabled ? 1 : 0)
  }
  
  if (data.apiConfig !== undefined) {
    fields.push('api_config = ?')
    values.push(data.apiConfig ? JSON.stringify(data.apiConfig) : null)
  }
  
  if (fields.length === 0) return false
  
  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)
  
  const result = await db.prepare(`UPDATE last_mile_carriers SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除承运商
 */
export async function deleteCarrier(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM last_mile_carriers WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== Zone配置管理 ====================

/**
 * 获取承运商的Zone列表
 */
export async function getZones(carrierId) {
  const db = getDatabase()
  const zones = await db.prepare(`
    SELECT * FROM last_mile_zones 
    WHERE carrier_id = ? 
    ORDER BY sort_order, zone_code
  `).all(carrierId)
  
  return zones.map(convertZoneToCamelCase)
}

/**
 * 根据ID获取Zone
 */
export async function getZoneById(id) {
  const db = getDatabase()
  const zone = await db.prepare('SELECT * FROM last_mile_zones WHERE id = ?').get(id)
  return zone ? convertZoneToCamelCase(zone) : null
}

/**
 * 创建Zone
 */
export async function createZone(data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    INSERT INTO last_mile_zones (
      carrier_id, zone_code, zone_name, countries, postal_prefixes, cities, description, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    data.carrierId,
    data.zoneCode,
    data.zoneName || '',
    data.countries ? JSON.stringify(data.countries) : null,
    data.postalPrefixes ? JSON.stringify(data.postalPrefixes) : null,
    data.cities ? JSON.stringify(data.cities) : null,
    data.description || '',
    data.sortOrder || 0
  )
  
  return { id: result.id }
}

/**
 * 更新Zone
 */
export async function updateZone(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  if (data.zoneCode !== undefined) {
    fields.push('zone_code = ?')
    values.push(data.zoneCode)
  }
  if (data.zoneName !== undefined) {
    fields.push('zone_name = ?')
    values.push(data.zoneName)
  }
  if (data.countries !== undefined) {
    fields.push('countries = ?')
    values.push(data.countries ? JSON.stringify(data.countries) : null)
  }
  if (data.postalPrefixes !== undefined) {
    fields.push('postal_prefixes = ?')
    values.push(data.postalPrefixes ? JSON.stringify(data.postalPrefixes) : null)
  }
  if (data.cities !== undefined) {
    fields.push('cities = ?')
    values.push(data.cities ? JSON.stringify(data.cities) : null)
  }
  if (data.description !== undefined) {
    fields.push('description = ?')
    values.push(data.description)
  }
  if (data.sortOrder !== undefined) {
    fields.push('sort_order = ?')
    values.push(data.sortOrder)
  }
  
  if (fields.length === 0) return false
  
  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)
  
  const result = await db.prepare(`UPDATE last_mile_zones SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除Zone
 */
export async function deleteZone(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM last_mile_zones WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 批量创建Zone
 */
export async function batchCreateZones(carrierId, zones) {
  const db = getDatabase()
  let successCount = 0
  
  for (const zone of zones) {
    try {
      await db.prepare(`
        INSERT INTO last_mile_zones (carrier_id, zone_code, zone_name, countries, postal_prefixes, cities, description, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        carrierId,
        zone.zoneCode,
        zone.zoneName || '',
        zone.countries ? JSON.stringify(zone.countries) : null,
        zone.postalPrefixes ? JSON.stringify(zone.postalPrefixes) : null,
        zone.cities ? JSON.stringify(zone.cities) : null,
        zone.description || '',
        zone.sortOrder || 0
      )
      successCount++
    } catch (err) {
      console.error('创建Zone失败:', err.message)
    }
  }
  
  return { successCount, totalCount: zones.length }
}

// ==================== 费率卡管理 ====================

/**
 * 获取费率卡列表
 */
export async function getRateCards(params = {}) {
  const db = getDatabase()
  const { carrierId, rateType, status, search, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM unified_rate_cards WHERE 1=1'
  const queryParams = []
  
  if (carrierId) {
    query += ' AND carrier_id = ?'
    queryParams.push(carrierId)
  }
  
  if (rateType) {
    query += ' AND rate_type = ?'
    queryParams.push(rateType)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (search) {
    query += ' AND (rate_card_code LIKE ? OR rate_card_name LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertRateCardToCamelCase),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 根据ID获取费率卡详情（含费率明细）
 */
export async function getRateCardById(id) {
  const db = getDatabase()
  const rateCard = await db.prepare('SELECT * FROM unified_rate_cards WHERE id = ?').get(id)
  if (!rateCard) return null
  
  // 获取费率明细
  const tiers = await db.prepare(`
    SELECT * FROM rate_card_tiers WHERE rate_card_id = ? ORDER BY zone_code, weight_from
  `).all(id)
  
  // 获取附加费
  const surcharges = await db.prepare(`
    SELECT * FROM rate_card_surcharges WHERE rate_card_id = ?
  `).all(id)
  
  const result = convertRateCardToCamelCase(rateCard)
  result.tiers = tiers.map(convertTierToCamelCase)
  result.surcharges = surcharges.map(convertSurchargeToCamelCase)
  
  return result
}

/**
 * 生成费率卡编码
 */
export async function generateRateCardCode(carrierId) {
  const db = getDatabase()
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  
  // 获取承运商编码
  const carrier = await db.prepare('SELECT carrier_code FROM last_mile_carriers WHERE id = ?').get(carrierId)
  const prefix = carrier ? `RC-${carrier.carrier_code}-${date}` : `RC-${date}`
  
  const result = await db.prepare(`
    SELECT rate_card_code FROM unified_rate_cards 
    WHERE rate_card_code LIKE ? 
    ORDER BY rate_card_code DESC LIMIT 1
  `).get(`${prefix}%`)
  
  let seq = 1
  if (result) {
    const lastSeq = parseInt(result.rate_card_code.slice(-3))
    if (!isNaN(lastSeq)) seq = lastSeq + 1
  }
  
  return `${prefix}-${String(seq).padStart(3, '0')}`
}

/**
 * 创建费率卡
 */
export async function createRateCard(data) {
  const db = getDatabase()
  
  const rateCardCode = data.rateCardCode || await generateRateCardCode(data.carrierId)
  
  const result = await db.prepare(`
    INSERT INTO unified_rate_cards (
      rate_card_code, rate_card_name, carrier_id, supplier_id, rate_type, service_type,
      valid_from, valid_until, currency, status, is_default, import_log_id, remark, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    rateCardCode,
    data.rateCardName,
    data.carrierId || null,
    data.supplierId || null,
    data.rateType || 'last_mile',
    data.serviceType || 'standard',
    data.validFrom,
    data.validUntil || null,
    data.currency || 'EUR',
    data.status || 'active',
    data.isDefault ? 1 : 0,
    data.importLogId || null,
    data.remark || '',
    data.createdBy || ''
  )
  
  return { id: result.id, rateCardCode }
}

/**
 * 更新费率卡
 */
export async function updateRateCard(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    rateCardName: 'rate_card_name',
    rateType: 'rate_type',
    serviceType: 'service_type',
    validFrom: 'valid_from',
    validUntil: 'valid_until',
    currency: 'currency',
    status: 'status',
    remark: 'remark'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (data.isDefault !== undefined) {
    fields.push('is_default = ?')
    values.push(data.isDefault ? 1 : 0)
  }
  
  if (fields.length === 0) return false
  
  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)
  
  const result = await db.prepare(`UPDATE unified_rate_cards SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除费率卡
 */
export async function deleteRateCard(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM unified_rate_cards WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 费率明细管理 ====================

/**
 * 创建费率明细
 */
export async function createRateTier(data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    INSERT INTO rate_card_tiers (
      rate_card_id, zone_id, zone_code, weight_from, weight_to,
      purchase_price, purchase_min_charge, sales_price, sales_min_charge,
      price_unit, margin_rate, margin_amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    data.rateCardId,
    data.zoneId || null,
    data.zoneCode || '',
    data.weightFrom,
    data.weightTo,
    data.purchasePrice || null,
    data.purchaseMinCharge || null,
    data.salesPrice || null,
    data.salesMinCharge || null,
    data.priceUnit || 'per_kg',
    data.marginRate || null,
    data.marginAmount || null
  )
  
  return { id: result.id }
}

/**
 * 批量创建费率明细
 */
export async function batchCreateRateTiers(rateCardId, tiers) {
  const db = getDatabase()
  let successCount = 0
  
  for (const tier of tiers) {
    try {
      await db.prepare(`
        INSERT INTO rate_card_tiers (
          rate_card_id, zone_id, zone_code, weight_from, weight_to,
          purchase_price, purchase_min_charge, sales_price, sales_min_charge,
          price_unit, margin_rate, margin_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rateCardId,
        tier.zoneId || null,
        tier.zoneCode || '',
        tier.weightFrom,
        tier.weightTo,
        tier.purchasePrice || null,
        tier.purchaseMinCharge || null,
        tier.salesPrice || null,
        tier.salesMinCharge || null,
        tier.priceUnit || 'per_kg',
        tier.marginRate || null,
        tier.marginAmount || null
      )
      successCount++
    } catch (err) {
      console.error('创建费率明细失败:', err.message)
    }
  }
  
  return { successCount, totalCount: tiers.length }
}

/**
 * 更新费率明细
 */
export async function updateRateTier(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    zoneId: 'zone_id',
    zoneCode: 'zone_code',
    weightFrom: 'weight_from',
    weightTo: 'weight_to',
    purchasePrice: 'purchase_price',
    purchaseMinCharge: 'purchase_min_charge',
    salesPrice: 'sales_price',
    salesMinCharge: 'sales_min_charge',
    priceUnit: 'price_unit',
    marginRate: 'margin_rate',
    marginAmount: 'margin_amount'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (fields.length === 0) return false
  
  values.push(id)
  const result = await db.prepare(`UPDATE rate_card_tiers SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除费率明细
 */
export async function deleteRateTier(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM rate_card_tiers WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 清空费率卡的所有明细
 */
export async function clearRateTiers(rateCardId) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM rate_card_tiers WHERE rate_card_id = ?').run(rateCardId)
  return result.changes
}

// ==================== 附加费管理 ====================

/**
 * 创建附加费
 */
export async function createSurcharge(data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    INSERT INTO rate_card_surcharges (
      rate_card_id, surcharge_code, surcharge_name, surcharge_name_en,
      charge_type, purchase_amount, sales_amount, percentage, is_mandatory, conditions
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    data.rateCardId,
    data.surchargeCode,
    data.surchargeName,
    data.surchargeNameEn || '',
    data.chargeType || 'fixed',
    data.purchaseAmount || null,
    data.salesAmount || null,
    data.percentage || null,
    data.isMandatory ? 1 : 0,
    data.conditions ? JSON.stringify(data.conditions) : null
  )
  
  return { id: result.id }
}

/**
 * 更新附加费
 */
export async function updateSurcharge(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    surchargeCode: 'surcharge_code',
    surchargeName: 'surcharge_name',
    surchargeNameEn: 'surcharge_name_en',
    chargeType: 'charge_type',
    purchaseAmount: 'purchase_amount',
    salesAmount: 'sales_amount',
    percentage: 'percentage'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (data.isMandatory !== undefined) {
    fields.push('is_mandatory = ?')
    values.push(data.isMandatory ? 1 : 0)
  }
  
  if (data.conditions !== undefined) {
    fields.push('conditions = ?')
    values.push(data.conditions ? JSON.stringify(data.conditions) : null)
  }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const result = await db.prepare(`UPDATE rate_card_surcharges SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除附加费
 */
export async function deleteSurcharge(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM rate_card_surcharges WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 运单管理 ====================

/**
 * 生成运单号
 */
export async function generateShipmentNo() {
  const db = getDatabase()
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `LM${date}`
  
  const result = await db.prepare(`
    SELECT shipment_no FROM last_mile_shipments 
    WHERE shipment_no LIKE ? 
    ORDER BY shipment_no DESC LIMIT 1
  `).get(`${prefix}%`)
  
  let seq = 1
  if (result) {
    const lastSeq = parseInt(result.shipment_no.slice(-4))
    if (!isNaN(lastSeq)) seq = lastSeq + 1
  }
  
  return `${prefix}${String(seq).padStart(4, '0')}`
}

/**
 * 获取运单列表
 */
export async function getShipments(params = {}) {
  const db = getDatabase()
  const { carrierId, status, billId, search, startDate, endDate, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM last_mile_shipments WHERE 1=1'
  const queryParams = []
  
  if (carrierId) {
    query += ' AND carrier_id = ?'
    queryParams.push(carrierId)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (billId) {
    query += ' AND bill_id = ?'
    queryParams.push(billId)
  }
  
  if (startDate) {
    query += ' AND created_at >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND created_at <= ?'
    queryParams.push(endDate)
  }
  
  if (search) {
    query += ' AND (shipment_no LIKE ? OR carrier_tracking_no LIKE ? OR receiver_name LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertShipmentToCamelCase),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 根据ID获取运单
 */
export async function getShipmentById(id) {
  const db = getDatabase()
  const shipment = await db.prepare('SELECT * FROM last_mile_shipments WHERE id = ?').get(id)
  return shipment ? convertShipmentToCamelCase(shipment) : null
}

/**
 * 根据运单号获取运单
 */
export async function getShipmentByNo(shipmentNo) {
  const db = getDatabase()
  const shipment = await db.prepare('SELECT * FROM last_mile_shipments WHERE shipment_no = ?').get(shipmentNo)
  return shipment ? convertShipmentToCamelCase(shipment) : null
}

/**
 * 创建运单
 */
export async function createShipment(data) {
  const db = getDatabase()
  const shipmentNo = data.shipmentNo || await generateShipmentNo()
  
  const result = await db.prepare(`
    INSERT INTO last_mile_shipments (
      shipment_no, carrier_id, carrier_code, carrier_tracking_no,
      bill_id, bill_number,
      sender_name, sender_company, sender_phone, sender_address, sender_city, sender_postal_code, sender_country,
      receiver_name, receiver_company, receiver_phone, receiver_address, receiver_city, receiver_postal_code, receiver_country,
      pieces, weight, volume_weight, chargeable_weight, dimensions, goods_description,
      service_type, zone_code, rate_card_id, purchase_cost, sales_amount, profit_amount, currency,
      status, label_url, label_data, api_request, api_response
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    shipmentNo,
    data.carrierId || null,
    data.carrierCode || '',
    data.carrierTrackingNo || '',
    data.billId || null,
    data.billNumber || '',
    data.senderName || '',
    data.senderCompany || '',
    data.senderPhone || '',
    data.senderAddress || '',
    data.senderCity || '',
    data.senderPostalCode || '',
    data.senderCountry || 'DE',
    data.receiverName || '',
    data.receiverCompany || '',
    data.receiverPhone || '',
    data.receiverAddress || '',
    data.receiverCity || '',
    data.receiverPostalCode || '',
    data.receiverCountry || '',
    data.pieces || 1,
    data.weight || null,
    data.volumeWeight || null,
    data.chargeableWeight || null,
    data.dimensions || '',
    data.goodsDescription || '',
    data.serviceType || 'standard',
    data.zoneCode || '',
    data.rateCardId || null,
    data.purchaseCost || null,
    data.salesAmount || null,
    data.profitAmount || null,
    data.currency || 'EUR',
    data.status || 'pending',
    data.labelUrl || null,
    data.labelData || null,
    data.apiRequest ? JSON.stringify(data.apiRequest) : null,
    data.apiResponse ? JSON.stringify(data.apiResponse) : null
  )
  
  return { id: result.id, shipmentNo }
}

/**
 * 更新运单
 */
export async function updateShipment(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    carrierTrackingNo: 'carrier_tracking_no',
    status: 'status',
    labelUrl: 'label_url',
    labelData: 'label_data',
    purchaseCost: 'purchase_cost',
    salesAmount: 'sales_amount',
    profitAmount: 'profit_amount',
    zoneCode: 'zone_code'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (data.apiRequest !== undefined) {
    fields.push('api_request = ?')
    values.push(data.apiRequest ? JSON.stringify(data.apiRequest) : null)
  }
  
  if (data.apiResponse !== undefined) {
    fields.push('api_response = ?')
    values.push(data.apiResponse ? JSON.stringify(data.apiResponse) : null)
  }
  
  if (data.shippedAt !== undefined) {
    fields.push('shipped_at = ?')
    values.push(data.shippedAt)
  }
  
  if (data.deliveredAt !== undefined) {
    fields.push('delivered_at = ?')
    values.push(data.deliveredAt)
  }
  
  if (fields.length === 0) return false
  
  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)
  
  const result = await db.prepare(`UPDATE last_mile_shipments SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除运单
 */
export async function deleteShipment(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM last_mile_shipments WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 运单轨迹 ====================

/**
 * 获取运单轨迹
 */
export async function getShipmentTracking(shipmentId) {
  const db = getDatabase()
  const tracking = await db.prepare(`
    SELECT * FROM last_mile_tracking 
    WHERE shipment_id = ? 
    ORDER BY event_time DESC
  `).all(shipmentId)
  
  return tracking.map(t => ({
    id: t.id,
    shipmentId: t.shipment_id,
    trackingNo: t.tracking_no,
    eventTime: t.event_time,
    eventCode: t.event_code,
    eventDescription: t.event_description,
    eventLocation: t.event_location,
    rawData: t.raw_data ? JSON.parse(t.raw_data) : null,
    createdAt: t.created_at
  }))
}

/**
 * 添加轨迹记录
 */
export async function addTrackingEvent(data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    INSERT INTO last_mile_tracking (
      shipment_id, tracking_no, event_time, event_code, event_description, event_location, raw_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    data.shipmentId,
    data.trackingNo || '',
    data.eventTime || new Date().toISOString(),
    data.eventCode || '',
    data.eventDescription || '',
    data.eventLocation || '',
    data.rawData ? JSON.stringify(data.rawData) : null
  )
  
  return { id: result.id }
}

// ==================== 数据转换函数 ====================

function convertCarrierToCamelCase(row) {
  if (!row) return null
  return {
    id: row.id,
    carrierCode: row.carrier_code,
    carrierName: row.carrier_name,
    carrierNameEn: row.carrier_name_en,
    carrierType: row.carrier_type,
    countryCode: row.country_code,
    serviceRegion: row.service_region,
    contactPerson: row.contact_person,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    website: row.website,
    apiEnabled: row.api_enabled === 1,
    apiConfig: row.api_config ? JSON.parse(row.api_config) : null,
    status: row.status,
    remark: row.remark,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function convertZoneToCamelCase(row) {
  if (!row) return null
  return {
    id: row.id,
    carrierId: row.carrier_id,
    zoneCode: row.zone_code,
    zoneName: row.zone_name,
    countries: row.countries ? (typeof row.countries === 'string' ? JSON.parse(row.countries) : row.countries) : [],
    postalPrefixes: row.postal_prefixes ? (typeof row.postal_prefixes === 'string' ? JSON.parse(row.postal_prefixes) : row.postal_prefixes) : [],
    cities: row.cities ? (typeof row.cities === 'string' ? JSON.parse(row.cities) : row.cities) : [],
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function convertRateCardToCamelCase(row) {
  if (!row) return null
  return {
    id: row.id,
    rateCardCode: row.rate_card_code,
    rateCardName: row.rate_card_name,
    carrierId: row.carrier_id,
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

function convertTierToCamelCase(row) {
  if (!row) return null
  return {
    id: row.id,
    rateCardId: row.rate_card_id,
    zoneId: row.zone_id,
    zoneCode: row.zone_code,
    weightFrom: parseFloat(row.weight_from) || 0,
    weightTo: parseFloat(row.weight_to) || 0,
    purchasePrice: row.purchase_price ? parseFloat(row.purchase_price) : null,
    purchaseMinCharge: row.purchase_min_charge ? parseFloat(row.purchase_min_charge) : null,
    salesPrice: row.sales_price ? parseFloat(row.sales_price) : null,
    salesMinCharge: row.sales_min_charge ? parseFloat(row.sales_min_charge) : null,
    priceUnit: row.price_unit,
    marginRate: row.margin_rate ? parseFloat(row.margin_rate) : null,
    marginAmount: row.margin_amount ? parseFloat(row.margin_amount) : null,
    createdAt: row.created_at
  }
}

function convertSurchargeToCamelCase(row) {
  if (!row) return null
  return {
    id: row.id,
    rateCardId: row.rate_card_id,
    surchargeCode: row.surcharge_code,
    surchargeName: row.surcharge_name,
    surchargeNameEn: row.surcharge_name_en,
    chargeType: row.charge_type,
    purchaseAmount: row.purchase_amount ? parseFloat(row.purchase_amount) : null,
    salesAmount: row.sales_amount ? parseFloat(row.sales_amount) : null,
    percentage: row.percentage ? parseFloat(row.percentage) : null,
    isMandatory: row.is_mandatory === 1,
    conditions: row.conditions ? JSON.parse(row.conditions) : null,
    createdAt: row.created_at
  }
}

function convertShipmentToCamelCase(row) {
  if (!row) return null
  return {
    id: row.id,
    shipmentNo: row.shipment_no,
    carrierId: row.carrier_id,
    carrierCode: row.carrier_code,
    carrierTrackingNo: row.carrier_tracking_no,
    billId: row.bill_id,
    billNumber: row.bill_number,
    senderName: row.sender_name,
    senderCompany: row.sender_company,
    senderPhone: row.sender_phone,
    senderAddress: row.sender_address,
    senderCity: row.sender_city,
    senderPostalCode: row.sender_postal_code,
    senderCountry: row.sender_country,
    receiverName: row.receiver_name,
    receiverCompany: row.receiver_company,
    receiverPhone: row.receiver_phone,
    receiverAddress: row.receiver_address,
    receiverCity: row.receiver_city,
    receiverPostalCode: row.receiver_postal_code,
    receiverCountry: row.receiver_country,
    pieces: row.pieces,
    weight: row.weight ? parseFloat(row.weight) : null,
    volumeWeight: row.volume_weight ? parseFloat(row.volume_weight) : null,
    chargeableWeight: row.chargeable_weight ? parseFloat(row.chargeable_weight) : null,
    dimensions: row.dimensions,
    goodsDescription: row.goods_description,
    serviceType: row.service_type,
    zoneCode: row.zone_code,
    rateCardId: row.rate_card_id,
    purchaseCost: row.purchase_cost ? parseFloat(row.purchase_cost) : null,
    salesAmount: row.sales_amount ? parseFloat(row.sales_amount) : null,
    profitAmount: row.profit_amount ? parseFloat(row.profit_amount) : null,
    currency: row.currency,
    status: row.status,
    labelUrl: row.label_url,
    labelData: row.label_data,
    apiRequest: row.api_request ? JSON.parse(row.api_request) : null,
    apiResponse: row.api_response ? JSON.parse(row.api_response) : null,
    createdAt: row.created_at,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    updatedAt: row.updated_at
  }
}

export default {
  // 常量
  CARRIER_TYPES,
  CARRIER_STATUS,
  RATE_TYPES,
  SERVICE_TYPES,
  SHIPMENT_STATUS,
  SETTLEMENT_STATUS,
  PAYMENT_STATUS,
  
  // 承运商
  getCarriers,
  getCarrierById,
  getCarrierByCode,
  createCarrier,
  updateCarrier,
  deleteCarrier,
  
  // Zone
  getZones,
  getZoneById,
  createZone,
  updateZone,
  deleteZone,
  batchCreateZones,
  
  // 费率卡
  getRateCards,
  getRateCardById,
  generateRateCardCode,
  createRateCard,
  updateRateCard,
  deleteRateCard,
  
  // 费率明细
  createRateTier,
  batchCreateRateTiers,
  updateRateTier,
  deleteRateTier,
  clearRateTiers,
  
  // 附加费
  createSurcharge,
  updateSurcharge,
  deleteSurcharge,
  
  // 运单
  generateShipmentNo,
  getShipments,
  getShipmentById,
  getShipmentByNo,
  createShipment,
  updateShipment,
  deleteShipment,
  
  // 轨迹
  getShipmentTracking,
  addTrackingEvent
}
