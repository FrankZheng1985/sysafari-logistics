/**
 * HS匹配记录管理模块
 * 用于记录已匹配的商品信息，方便后续快速匹配和申报参考
 */
import { getDatabase } from '../../config/database.js'

/**
 * 保存或更新匹配记录
 * 如果相同品名+材质的记录已存在，则更新；否则创建新记录
 */
export async function saveMatchRecord(data) {
  const db = getDatabase()
  const now = new Date().toISOString()

  // 查找是否已存在相同品名+材质的记录
  const existing = await db.prepare(`
    SELECT * FROM hs_match_records 
    WHERE product_name = ? AND COALESCE(material, '') = COALESCE(?, '')
    AND status = 'active'
  `).get(data.productName, data.material || '')

  if (existing) {
    // 更新现有记录
    const newTotalQty = existing.total_declared_qty + (data.quantity || 0)
    const newTotalWeight = parseFloat(existing.total_declared_weight) + (data.weight || 0)
    const newTotalValue = parseFloat(existing.total_declared_value) + (data.declaredValue || 0)
    const newMatchCount = existing.match_count + 1

    // 计算新的平均价格
    const newAvgUnitPrice = newTotalQty > 0 ? newTotalValue / newTotalQty : 0
    const newAvgKgPrice = newTotalWeight > 0 ? newTotalValue / newTotalWeight : 0

    // 更新最低/最高单价
    const unitPrice = data.unitPrice || 0
    const newMinPrice = unitPrice > 0 ? Math.min(existing.min_unit_price || unitPrice, unitPrice) : existing.min_unit_price
    const newMaxPrice = Math.max(existing.max_unit_price || 0, unitPrice)

    await db.prepare(`
      UPDATE hs_match_records SET
        hs_code = ?,
        product_name_en = COALESCE(?, product_name_en),
        material_en = COALESCE(?, material_en),
        origin_country = COALESCE(?, origin_country),
        origin_country_code = COALESCE(?, origin_country_code),
        avg_unit_price = ?,
        avg_kg_price = ?,
        min_unit_price = ?,
        max_unit_price = ?,
        total_declared_value = ?,
        total_declared_qty = ?,
        total_declared_weight = ?,
        duty_rate = COALESCE(?, duty_rate),
        vat_rate = COALESCE(?, vat_rate),
        anti_dumping_rate = COALESCE(?, anti_dumping_rate),
        countervailing_rate = COALESCE(?, countervailing_rate),
        match_count = ?,
        last_match_time = ?,
        customer_id = COALESCE(?, customer_id),
        customer_name = COALESCE(?, customer_name),
        updated_at = ?
      WHERE id = ?
    `).run(
      data.hsCode,
      data.productNameEn,
      data.materialEn,
      data.originCountry,
      data.originCountryCode,
      newAvgUnitPrice,
      newAvgKgPrice,
      newMinPrice,
      newMaxPrice,
      newTotalValue,
      newTotalQty,
      newTotalWeight,
      data.dutyRate,
      data.vatRate,
      data.antiDumpingRate,
      data.countervailingRate,
      newMatchCount,
      now,
      data.customerId,
      data.customerName,
      now,
      existing.id
    )

    return { id: existing.id, isNew: false }
  } else {
    // 创建新记录（默认已核实）
    const unitPrice = data.unitPrice || 0
    const kgPrice = data.weight > 0 ? (data.declaredValue || 0) / data.weight : 0

    const result = await db.prepare(`
      INSERT INTO hs_match_records (
        product_name, product_name_en, hs_code, material, material_en,
        origin_country, origin_country_code,
        avg_unit_price, avg_kg_price, min_unit_price, max_unit_price,
        total_declared_value, total_declared_qty, total_declared_weight,
        duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
        match_count, first_match_time, last_match_time,
        customer_id, customer_name,
        is_verified, verified_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.productName,
      data.productNameEn || null,
      data.hsCode,
      data.material || null,
      data.materialEn || null,
      data.originCountry || 'CN',
      data.originCountryCode || 'CN',
      unitPrice,
      kgPrice,
      unitPrice > 0 ? unitPrice : 0,
      unitPrice,
      data.declaredValue || 0,
      data.quantity || 0,
      data.weight || 0,
      data.dutyRate || 0,
      data.vatRate || 19,
      data.antiDumpingRate || 0,
      data.countervailingRate || 0,
      1,
      now,
      now,
      data.customerId || null,
      data.customerName || null,
      1,    // is_verified - 默认已核实
      now,  // verified_at
      now,
      now
    )

    return { id: result.lastInsertRowid, isNew: true }
  }
}

/**
 * 添加申报历史记录
 */
export async function addMatchHistory(matchRecordId, data) {
  const db = getDatabase()
  const now = new Date().toISOString()

  const kgPrice = data.weight > 0 ? (data.declaredValue || 0) / data.weight : 0

  const result = await db.prepare(`
    INSERT INTO hs_declaration_history (
      match_record_id, import_id, import_no, cargo_item_id,
      declared_qty, declared_weight, declared_value,
      unit_price, kg_price,
      duty_amount, vat_amount, other_tax_amount, total_tax,
      declared_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    matchRecordId,
    data.importId || null,
    data.importNo || null,
    data.cargoItemId || null,
    data.quantity || 0,
    data.weight || 0,
    data.declaredValue || 0,
    data.unitPrice || 0,
    kgPrice,
    data.dutyAmount || 0,
    data.vatAmount || 0,
    data.otherTaxAmount || 0,
    data.totalTax || 0,
    now
  )

  return result.lastInsertRowid
}

/**
 * 根据品名搜索匹配记录（用于快速匹配建议）
 */
export async function searchMatchRecords(keyword, limit = 20) {
  const db = getDatabase()

  const rows = await db.prepare(`
    SELECT 
      id, product_name, product_name_en, hs_code, material, material_en,
      origin_country, avg_unit_price, avg_kg_price,
      duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
      match_count, last_match_time
    FROM hs_match_records
    WHERE status = 'active'
      AND (product_name ILIKE ? OR product_name_en ILIKE ? OR material ILIKE ?)
    ORDER BY match_count DESC, last_match_time DESC
    LIMIT ?
  `).all(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, limit)

  return (rows || []).map(row => ({
    id: row.id,
    productName: row.product_name,
    productNameEn: row.product_name_en,
    hsCode: row.hs_code,
    material: row.material,
    materialEn: row.material_en,
    originCountry: row.origin_country,
    avgUnitPrice: parseFloat(row.avg_unit_price) || 0,
    avgKgPrice: parseFloat(row.avg_kg_price) || 0,
    dutyRate: parseFloat(row.duty_rate) || 0,
    vatRate: parseFloat(row.vat_rate) || 19,
    antiDumpingRate: parseFloat(row.anti_dumping_rate) || 0,
    countervailingRate: parseFloat(row.countervailing_rate) || 0,
    matchCount: row.match_count,
    lastMatchTime: row.last_match_time
  }))
}

/**
 * 获取匹配记录列表
 */
export async function getMatchRecordsList(options = {}) {
  const db = getDatabase()
  const { page = 1, pageSize = 20, keyword, hsCode, status = 'active' } = options

  let whereClause = 'WHERE status = ?'
  const params = [status]

  if (keyword) {
    whereClause += ' AND (product_name ILIKE ? OR product_name_en ILIKE ? OR material ILIKE ?)'
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  }

  if (hsCode) {
    whereClause += ' AND hs_code LIKE ?'
    params.push(`${hsCode}%`)
  }

  // 获取总数和全局统计（不受分页影响）
  const statsResult = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) as verified_count,
      SUM(match_count) as total_match_count,
      SUM(total_declared_value) as total_declared_value
    FROM hs_match_records ${whereClause}
  `).get(...params)

  // 获取列表
  const offset = (page - 1) * pageSize
  const rows = await db.prepare(`
    SELECT * FROM hs_match_records 
    ${whereClause}
    ORDER BY match_count DESC, last_match_time DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset)

  return {
    total: statsResult?.total || 0,
    // 全局统计数据
    stats: {
      totalRecords: statsResult?.total || 0,
      verifiedCount: statsResult?.verified_count || 0,
      totalMatchCount: statsResult?.total_match_count || 0,
      totalDeclaredValue: parseFloat(statsResult?.total_declared_value) || 0
    },
    page,
    pageSize,
    list: (rows || []).map(row => ({
      id: row.id,
      productName: row.product_name,
      productNameEn: row.product_name_en,
      hsCode: row.hs_code,
      material: row.material,
      materialEn: row.material_en,
      originCountry: row.origin_country,
      originCountryCode: row.origin_country_code,
      avgUnitPrice: parseFloat(row.avg_unit_price) || 0,
      avgKgPrice: parseFloat(row.avg_kg_price) || 0,
      minUnitPrice: parseFloat(row.min_unit_price) || 0,
      maxUnitPrice: parseFloat(row.max_unit_price) || 0,
      totalDeclaredValue: parseFloat(row.total_declared_value) || 0,
      totalDeclaredQty: row.total_declared_qty || 0,
      totalDeclaredWeight: parseFloat(row.total_declared_weight) || 0,
      dutyRate: parseFloat(row.duty_rate) || 0,
      vatRate: parseFloat(row.vat_rate) || 19,
      antiDumpingRate: parseFloat(row.anti_dumping_rate) || 0,
      countervailingRate: parseFloat(row.countervailing_rate) || 0,
      matchCount: row.match_count,
      firstMatchTime: row.first_match_time,
      lastMatchTime: row.last_match_time,
      customerName: row.customer_name,
      isVerified: row.is_verified === 1,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // 新增字段
      minDeclarationValueRange: row.min_declaration_value_range,
      refWeightRange: row.ref_weight_range,
      usageScenario: row.usage_scenario
    }))
  }
}

/**
 * 获取匹配记录详情（含申报历史）
 */
export async function getMatchRecordDetail(id) {
  const db = getDatabase()

  const record = await db.prepare('SELECT * FROM hs_match_records WHERE id = ?').get(id)
  if (!record) {
    return null
  }

  // 获取申报历史
  const history = await db.prepare(`
    SELECT * FROM hs_declaration_history 
    WHERE match_record_id = ?
    ORDER BY declared_at DESC
    LIMIT 50
  `).all(id)

  return {
    id: record.id,
    productName: record.product_name,
    productNameEn: record.product_name_en,
    hsCode: record.hs_code,
    material: record.material,
    materialEn: record.material_en,
    originCountry: record.origin_country,
    originCountryCode: record.origin_country_code,
    avgUnitPrice: parseFloat(record.avg_unit_price) || 0,
    avgKgPrice: parseFloat(record.avg_kg_price) || 0,
    minUnitPrice: parseFloat(record.min_unit_price) || 0,
    maxUnitPrice: parseFloat(record.max_unit_price) || 0,
    totalDeclaredValue: parseFloat(record.total_declared_value) || 0,
    totalDeclaredQty: record.total_declared_qty || 0,
    totalDeclaredWeight: parseFloat(record.total_declared_weight) || 0,
    dutyRate: parseFloat(record.duty_rate) || 0,
    vatRate: parseFloat(record.vat_rate) || 19,
    antiDumpingRate: parseFloat(record.anti_dumping_rate) || 0,
    countervailingRate: parseFloat(record.countervailing_rate) || 0,
    matchCount: record.match_count,
    firstMatchTime: record.first_match_time,
    lastMatchTime: record.last_match_time,
    customerId: record.customer_id,
    customerName: record.customer_name,
    remarks: record.remarks,
    isVerified: record.is_verified === 1,
    verifiedBy: record.verified_by,
    verifiedAt: record.verified_at,
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    // 新增字段
    minDeclarationValueRange: record.min_declaration_value_range,
    refWeightRange: record.ref_weight_range,
    usageScenario: record.usage_scenario,
    history: (history || []).map(h => ({
      id: h.id,
      importId: h.import_id,
      importNo: h.import_no,
      cargoItemId: h.cargo_item_id,
      declaredQty: h.declared_qty,
      declaredWeight: parseFloat(h.declared_weight) || 0,
      declaredValue: parseFloat(h.declared_value) || 0,
      unitPrice: parseFloat(h.unit_price) || 0,
      kgPrice: parseFloat(h.kg_price) || 0,
      dutyAmount: parseFloat(h.duty_amount) || 0,
      vatAmount: parseFloat(h.vat_amount) || 0,
      otherTaxAmount: parseFloat(h.other_tax_amount) || 0,
      totalTax: parseFloat(h.total_tax) || 0,
      declaredAt: h.declared_at
    }))
  }
}

/**
 * 更新匹配记录
 */
export async function updateMatchRecord(id, data) {
  const db = getDatabase()
  const now = new Date().toISOString()

  await db.prepare(`
    UPDATE hs_match_records SET
      product_name = COALESCE(?, product_name),
      product_name_en = COALESCE(?, product_name_en),
      hs_code = COALESCE(?, hs_code),
      material = COALESCE(?, material),
      material_en = COALESCE(?, material_en),
      origin_country = COALESCE(?, origin_country),
      duty_rate = COALESCE(?, duty_rate),
      vat_rate = COALESCE(?, vat_rate),
      anti_dumping_rate = COALESCE(?, anti_dumping_rate),
      countervailing_rate = COALESCE(?, countervailing_rate),
      remarks = COALESCE(?, remarks),
      updated_at = ?
    WHERE id = ?
  `).run(
    data.productName,
    data.productNameEn,
    data.hsCode,
    data.material,
    data.materialEn,
    data.originCountry,
    data.dutyRate,
    data.vatRate,
    data.antiDumpingRate,
    data.countervailingRate,
    data.remarks,
    now,
    id
  )

  return true
}

/**
 * 验证匹配记录
 */
export async function verifyMatchRecord(id, verifiedBy) {
  const db = getDatabase()
  const now = new Date().toISOString()

  await db.prepare(`
    UPDATE hs_match_records SET
      is_verified = 1,
      verified_by = ?,
      verified_at = ?,
      updated_at = ?
    WHERE id = ?
  `).run(verifiedBy, now, now, id)

  return true
}

/**
 * 删除匹配记录（软删除）
 */
export async function deleteMatchRecord(id) {
  const db = getDatabase()
  const now = new Date().toISOString()

  await db.prepare(`
    UPDATE hs_match_records SET
      status = 'archived',
      updated_at = ?
    WHERE id = ?
  `).run(now, id)

  return true
}

/**
 * 批量保存匹配记录（用于税费计算完成后）
 */
export async function batchSaveFromTaxCalc(importId, items) {
  const db = getDatabase()
  const results = []

  for (const item of items) {
    if (!item.productName || !item.matchedHsCode) continue

    try {
      // 保存匹配记录
      const recordResult = await saveMatchRecord({
        productName: item.productName,
        productNameEn: item.productNameEn,
        hsCode: item.matchedHsCode,
        material: item.material,
        materialEn: item.materialEn,
        originCountry: item.originCountry || 'CN',
        originCountryCode: item.originCountryCode || 'CN',
        quantity: item.quantity || 0,
        weight: item.grossWeight || 0,
        declaredValue: item.totalValue || 0,
        unitPrice: item.unitPrice || 0,
        dutyRate: item.dutyRate,
        vatRate: item.vatRate,
        antiDumpingRate: item.antiDumpingRate,
        countervailingRate: item.countervailingRate,
        customerId: item.customerId,
        customerName: item.customerName
      })

      // 添加申报历史
      await addMatchHistory(recordResult.id, {
        importId: importId,
        importNo: item.importNo,
        cargoItemId: item.id,
        quantity: item.quantity || 0,
        weight: item.grossWeight || 0,
        declaredValue: item.totalValue || 0,
        unitPrice: item.unitPrice || 0,
        dutyAmount: item.dutyAmount || 0,
        vatAmount: item.vatAmount || 0,
        otherTaxAmount: item.otherTaxAmount || 0,
        totalTax: item.totalTax || 0
      })

      results.push({ itemId: item.id, recordId: recordResult.id, success: true })
    } catch (error) {
      console.error(`保存匹配记录失败 (itemId: ${item.id}):`, error.message)
      results.push({ itemId: item.id, success: false, error: error.message })
    }
  }

  return results
}

/**
 * 检测价格异常（与历史记录对比）
 * 如果价格差异超过±5%，返回异常信息
 * @param {string} productName - 商品品名
 * @param {string} material - 材质
 * @param {number} unitPrice - 当前单价
 * @param {number} kgPrice - 当前公斤价（可选）
 * @returns {Object} 检测结果
 */
export async function checkPriceAnomaly(productName, material, unitPrice, kgPrice = 0) {
  const db = getDatabase()
  const THRESHOLD = 0.05 // 5% 阈值

  // 查找历史记录
  const record = await db.prepare(`
    SELECT 
      avg_unit_price, avg_kg_price, min_unit_price, max_unit_price,
      match_count, product_name, hs_code
    FROM hs_match_records 
    WHERE product_name = ? AND COALESCE(material, '') = COALESCE(?, '')
    AND status = 'active'
  `).get(productName, material || '')

  if (!record || record.match_count === 0) {
    // 没有历史记录，不需要审核
    return {
      hasAnomaly: false,
      isNewProduct: true,
      message: '新商品，无历史记录'
    }
  }

  const avgPrice = parseFloat(record.avg_unit_price) || 0
  const avgKgPrice = parseFloat(record.avg_kg_price) || 0

  // 计算单价差异
  let priceDeviation = 0
  let kgPriceDeviation = 0
  let anomalyReasons = []

  if (avgPrice > 0 && unitPrice > 0) {
    priceDeviation = Math.abs(unitPrice - avgPrice) / avgPrice
    if (priceDeviation > THRESHOLD) {
      const direction = unitPrice > avgPrice ? '高于' : '低于'
      anomalyReasons.push(`单价${direction}历史均价 ${(priceDeviation * 100).toFixed(1)}%`)
    }
  }

  if (avgKgPrice > 0 && kgPrice > 0) {
    kgPriceDeviation = Math.abs(kgPrice - avgKgPrice) / avgKgPrice
    if (kgPriceDeviation > THRESHOLD) {
      const direction = kgPrice > avgKgPrice ? '高于' : '低于'
      anomalyReasons.push(`公斤价${direction}历史均价 ${(kgPriceDeviation * 100).toFixed(1)}%`)
    }
  }

  const hasAnomaly = anomalyReasons.length > 0

  return {
    hasAnomaly,
    isNewProduct: false,
    priceDeviation: (priceDeviation * 100).toFixed(1),
    kgPriceDeviation: (kgPriceDeviation * 100).toFixed(1),
    historyAvgPrice: avgPrice,
    historyAvgKgPrice: avgKgPrice,
    historyMinPrice: parseFloat(record.min_unit_price) || 0,
    historyMaxPrice: parseFloat(record.max_unit_price) || 0,
    matchCount: record.match_count,
    hsCode: record.hs_code,
    anomalyReasons,
    message: hasAnomaly 
      ? `价格异常: ${anomalyReasons.join('; ')}` 
      : '价格正常'
  }
}

/**
 * 批量检测价格异常
 * @param {Array} items - 商品列表
 * @returns {Array} 检测结果列表
 */
export async function batchCheckPriceAnomaly(items) {
  const results = []
  
  for (const item of items) {
    const unitPrice = item.unitPrice || (item.totalValue && item.quantity ? item.totalValue / item.quantity : 0)
    const kgPrice = item.grossWeight > 0 ? (item.totalValue || 0) / item.grossWeight : 0
    
    const result = await checkPriceAnomaly(
      item.productName,
      item.material,
      unitPrice,
      kgPrice
    )
    
    results.push({
      itemId: item.id,
      productName: item.productName,
      currentUnitPrice: unitPrice,
      currentKgPrice: kgPrice,
      ...result
    })
  }
  
  return results
}

export default {
  saveMatchRecord,
  addMatchHistory,
  searchMatchRecords,
  getMatchRecordsList,
  getMatchRecordDetail,
  updateMatchRecord,
  verifyMatchRecord,
  deleteMatchRecord,
  batchSaveFromTaxCalc,
  checkPriceAnomaly,
  batchCheckPriceAnomaly
}
