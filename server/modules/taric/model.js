/**
 * TARIC 模块 - 数据模型
 * 欧盟关税税率数据同步和管理
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== 同步日志管理 ====================

/**
 * 创建同步日志
 */
export async function createSyncLog(data) {
  const db = getDatabase()
  const id = generateId('SYNC')
  
  await db.prepare(`
    INSERT INTO taric_sync_logs (
      id, sync_type, data_source, source_url, file_name,
      taric_version, status, started_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, 'running', NOW(), ?)
  `).run(
    id,
    data.syncType || 'full',
    data.dataSource || 'excel',
    data.sourceUrl || null,
    data.fileName || null,
    data.taricVersion || null,
    data.createdBy || null
  )
  
  return { id }
}

/**
 * 更新同步日志
 */
export async function updateSyncLog(id, data) {
  const db = getDatabase()
  const updates = []
  const values = []
  
  if (data.status !== undefined) {
    updates.push('status = ?')
    values.push(data.status)
  }
  if (data.progress !== undefined) {
    updates.push('progress = ?')
    values.push(data.progress)
  }
  if (data.totalRecords !== undefined) {
    updates.push('total_records = ?')
    values.push(data.totalRecords)
  }
  if (data.insertedCount !== undefined) {
    updates.push('inserted_count = ?')
    values.push(data.insertedCount)
  }
  if (data.updatedCount !== undefined) {
    updates.push('updated_count = ?')
    values.push(data.updatedCount)
  }
  if (data.skippedCount !== undefined) {
    updates.push('skipped_count = ?')
    values.push(data.skippedCount)
  }
  if (data.failedCount !== undefined) {
    updates.push('failed_count = ?')
    values.push(data.failedCount)
  }
  if (data.errorMessage !== undefined) {
    updates.push('error_message = ?')
    values.push(data.errorMessage)
  }
  if (data.taricVersion !== undefined) {
    updates.push('taric_version = ?')
    values.push(data.taricVersion)
  }
  if (data.status === 'completed' || data.status === 'failed') {
    updates.push('completed_at = NOW()')
  }
  
  if (updates.length === 0) return null
  
  values.push(id)
  await db.prepare(`
    UPDATE taric_sync_logs SET ${updates.join(', ')} WHERE id = ?
  `).run(...values)
  
  return { id }
}

/**
 * 获取同步日志列表
 */
export async function getSyncLogs(params = {}) {
  const db = getDatabase()
  const { status, syncType, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM taric_sync_logs WHERE 1=1'
  const queryParams = []
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  if (syncType) {
    query += ' AND sync_type = ?'
    queryParams.push(syncType)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertSyncLogToCamelCase),
    total: Number(totalResult.total),
    page,
    pageSize
  }
}

/**
 * 获取最新同步状态
 */
export async function getLatestSyncStatus() {
  const db = getDatabase()
  
  // 获取最后一次成功同步
  const lastSuccess = await db.prepare(`
    SELECT * FROM taric_sync_logs 
    WHERE status = 'completed' 
    ORDER BY completed_at DESC 
    LIMIT 1
  `).get()
  
  // 获取当前运行中的同步
  const running = await db.prepare(`
    SELECT * FROM taric_sync_logs 
    WHERE status = 'running' 
    ORDER BY started_at DESC 
    LIMIT 1
  `).get()
  
  // 获取税率统计
  const tariffStats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN data_source = 'taric' THEN 1 ELSE 0 END) as from_taric,
      MAX(last_sync_time) as last_sync_time
    FROM tariff_rates
  `).get()
  
  return {
    lastSync: lastSuccess ? convertSyncLogToCamelCase(lastSuccess) : null,
    currentSync: running ? convertSyncLogToCamelCase(running) : null,
    tariffStats: {
      total: Number(tariffStats.total || 0),
      active: Number(tariffStats.active || 0),
      fromTaric: Number(tariffStats.from_taric || 0),
      lastSyncTime: tariffStats.last_sync_time
    }
  }
}

// ==================== 税率数据管理 ====================

/**
 * 批量插入/更新税率数据
 */
export async function upsertTariffRates(rates, syncLogId, taricVersion) {
  const db = getDatabase()
  let insertedCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let failedCount = 0
  
  for (const rate of rates) {
    try {
      // 检查是否存在（按 hs_code + origin_country_code + measure_type 唯一）
      const existing = await db.prepare(`
        SELECT id FROM tariff_rates 
        WHERE hs_code = ? 
        AND COALESCE(origin_country_code, '') = COALESCE(?, '')
        AND COALESCE(measure_type, '') = COALESCE(?, '')
      `).get(rate.hsCode, rate.originCountryCode || '', rate.measureType || '')
      
      if (existing) {
        // 更新
        await db.prepare(`
          UPDATE tariff_rates SET
            hs_code_10 = COALESCE(?, hs_code_10),
            taric_code = COALESCE(?, taric_code),
            goods_description = COALESCE(?, goods_description),
            goods_description_cn = COALESCE(?, goods_description_cn),
            origin_country = COALESCE(?, origin_country),
            duty_rate = COALESCE(?, duty_rate),
            third_country_duty = COALESCE(?, third_country_duty),
            vat_rate = COALESCE(?, vat_rate),
            anti_dumping_rate = COALESCE(?, anti_dumping_rate),
            preferential_rate = COALESCE(?, preferential_rate),
            geographical_area = COALESCE(?, geographical_area),
            unit_code = COALESCE(?, unit_code),
            unit_name = COALESCE(?, unit_name),
            measure_code = COALESCE(?, measure_code),
            additional_code = COALESCE(?, additional_code),
            start_date = COALESCE(?, start_date),
            end_date = COALESCE(?, end_date),
            regulation_id = COALESCE(?, regulation_id),
            regulation_url = COALESCE(?, regulation_url),
            taric_version = ?,
            data_source = 'taric',
            last_sync_time = NOW(),
            updated_at = NOW()
          WHERE id = ?
        `).run(
          rate.hsCode10 || null,
          rate.taricCode || null,
          rate.goodsDescription || null,
          rate.goodsDescriptionCn || null,
          rate.originCountry || null,
          rate.dutyRate ?? null,
          rate.thirdCountryDuty ?? null,
          rate.vatRate ?? null,
          rate.antiDumpingRate ?? null,
          rate.preferentialRate ?? null,
          rate.geographicalArea || null,
          rate.unitCode || null,
          rate.unitName || null,
          rate.measureCode || null,
          rate.additionalCode || null,
          rate.startDate || null,
          rate.endDate || null,
          rate.regulationId || null,
          rate.regulationUrl || null,
          taricVersion,
          existing.id
        )
        updatedCount++
      } else {
        // 插入 - 不指定 id，让数据库自动生成
        await db.prepare(`
          INSERT INTO tariff_rates (
            hs_code, hs_code_10, taric_code, goods_description, goods_description_cn,
            origin_country, origin_country_code, duty_rate, third_country_duty,
            vat_rate, anti_dumping_rate, preferential_rate, geographical_area,
            unit_code, unit_name, measure_type, measure_code, additional_code,
            start_date, end_date, regulation_id, regulation_url,
            taric_version, data_source, last_sync_time, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'taric', NOW(), 1)
        `).run(
          rate.hsCode,
          rate.hsCode10 || null,
          rate.taricCode || null,
          rate.goodsDescription || '',
          rate.goodsDescriptionCn || null,
          rate.originCountry || null,
          rate.originCountryCode || null,
          rate.dutyRate ?? 0,
          rate.thirdCountryDuty ?? null,
          rate.vatRate ?? 19,
          rate.antiDumpingRate ?? 0,
          rate.preferentialRate ?? null,
          rate.geographicalArea || null,
          rate.unitCode || null,
          rate.unitName || null,
          rate.measureType || null,
          rate.measureCode || null,
          rate.additionalCode || null,
          rate.startDate || null,
          rate.endDate || null,
          rate.regulationId || null,
          rate.regulationUrl || null,
          taricVersion
        )
        insertedCount++
      }
    } catch (error) {
      console.error(`导入税率失败 [${rate.hsCode}]:`, error.message)
      failedCount++
    }
  }
  
  return { insertedCount, updatedCount, skippedCount, failedCount }
}

// ==================== 贸易协定管理 ====================

/**
 * 批量插入/更新贸易协定
 */
export async function upsertTradeAgreements(agreements, taricVersion) {
  const db = getDatabase()
  let insertedCount = 0
  let updatedCount = 0
  
  for (const agreement of agreements) {
    try {
      const existing = await db.prepare(`
        SELECT id FROM trade_agreements 
        WHERE agreement_code = ? AND COALESCE(country_code, '') = COALESCE(?, '')
      `).get(agreement.agreementCode, agreement.countryCode || '')
      
      if (existing) {
        await db.prepare(`
          UPDATE trade_agreements SET
            agreement_name = COALESCE(?, agreement_name),
            agreement_name_cn = COALESCE(?, agreement_name_cn),
            agreement_type = COALESCE(?, agreement_type),
            country_name = COALESCE(?, country_name),
            country_name_cn = COALESCE(?, country_name_cn),
            geographical_area = COALESCE(?, geographical_area),
            preferential_rate = COALESCE(?, preferential_rate),
            conditions = COALESCE(?, conditions),
            document_code = COALESCE(?, document_code),
            valid_from = COALESCE(?, valid_from),
            valid_to = COALESCE(?, valid_to),
            taric_version = ?,
            last_sync_at = NOW(),
            updated_at = NOW()
          WHERE id = ?
        `).run(
          agreement.agreementName || null,
          agreement.agreementNameCn || null,
          agreement.agreementType || null,
          agreement.countryName || null,
          agreement.countryNameCn || null,
          agreement.geographicalArea || null,
          agreement.preferentialRate ?? null,
          agreement.conditions || null,
          agreement.documentCode || null,
          agreement.validFrom || null,
          agreement.validTo || null,
          taricVersion,
          existing.id
        )
        updatedCount++
      } else {
        const id = generateId('TA')
        await db.prepare(`
          INSERT INTO trade_agreements (
            id, agreement_code, agreement_name, agreement_name_cn, agreement_type,
            country_code, country_name, country_name_cn, geographical_area,
            preferential_rate, conditions, document_code, valid_from, valid_to,
            taric_version, last_sync_at, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1)
        `).run(
          id,
          agreement.agreementCode,
          agreement.agreementName || '',
          agreement.agreementNameCn || null,
          agreement.agreementType || null,
          agreement.countryCode || null,
          agreement.countryName || null,
          agreement.countryNameCn || null,
          agreement.geographicalArea || null,
          agreement.preferentialRate ?? null,
          agreement.conditions || null,
          agreement.documentCode || null,
          agreement.validFrom || null,
          agreement.validTo || null,
          taricVersion
        )
        insertedCount++
      }
    } catch (error) {
      console.error(`导入贸易协定失败 [${agreement.agreementCode}]:`, error.message)
    }
  }
  
  return { insertedCount, updatedCount }
}

/**
 * 获取贸易协定列表
 */
export async function getTradeAgreements(params = {}) {
  const db = getDatabase()
  const { countryCode, agreementType, search, page = 1, pageSize = 50 } = params
  
  let query = 'SELECT * FROM trade_agreements WHERE is_active = 1'
  const queryParams = []
  
  if (countryCode) {
    query += ' AND country_code = ?'
    queryParams.push(countryCode)
  }
  if (agreementType) {
    query += ' AND agreement_type = ?'
    queryParams.push(agreementType)
  }
  if (search) {
    query += ' AND (agreement_name LIKE ? OR country_name LIKE ? OR agreement_code LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  query += ' ORDER BY agreement_code ASC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertAgreementToCamelCase),
    total: Number(totalResult.total),
    page,
    pageSize
  }
}

// ==================== 辅助函数 ====================

function convertSyncLogToCamelCase(row) {
  if (!row) return null
  return {
    id: row.id,
    syncType: row.sync_type,
    dataSource: row.data_source,
    sourceUrl: row.source_url,
    fileName: row.file_name,
    taricVersion: row.taric_version,
    totalRecords: row.total_records,
    insertedCount: row.inserted_count,
    updatedCount: row.updated_count,
    skippedCount: row.skipped_count,
    failedCount: row.failed_count,
    status: row.status,
    progress: row.progress,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdBy: row.created_by,
    createdAt: row.created_at
  }
}

function convertAgreementToCamelCase(row) {
  if (!row) return null
  return {
    id: row.id,
    agreementCode: row.agreement_code,
    agreementName: row.agreement_name,
    agreementNameCn: row.agreement_name_cn,
    agreementType: row.agreement_type,
    countryCode: row.country_code,
    countryName: row.country_name,
    countryNameCn: row.country_name_cn,
    geographicalArea: row.geographical_area,
    preferentialRate: row.preferential_rate,
    conditions: row.conditions,
    documentCode: row.document_code,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    isActive: row.is_active,
    taricVersion: row.taric_version,
    lastSyncAt: row.last_sync_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export default {
  createSyncLog,
  updateSyncLog,
  getSyncLogs,
  getLatestSyncStatus,
  upsertTariffRates,
  upsertTradeAgreements,
  getTradeAgreements
}
